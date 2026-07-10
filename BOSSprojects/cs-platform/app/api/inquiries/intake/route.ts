export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { waitUntil } from '@vercel/functions'
import type { Database, SourceChannel } from '@/lib/types'

function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function normalizeChannel(raw: string): SourceChannel {
  if (raw === 'mail') return 'email'
  return raw as SourceChannel
}

function collectInquiryNumbers(value: unknown, results: Set<string>, seen: Set<object>) {
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)

  if (Array.isArray(value)) {
    for (const item of value) collectInquiryNumbers(item, results, seen)
    return
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key === 'inquiryNumber' && (typeof nested === 'string' || typeof nested === 'number')) {
      const inquiryNumber = String(nested).trim()
      if (inquiryNumber) results.add(inquiryNumber)
    } else {
      collectInquiryNumbers(nested, results, seen)
    }
  }
}

function resolveExternalId(
  channel: SourceChannel,
  externalInquiryId: unknown,
  rawPayload: unknown,
): { externalId?: string; reason?: string } {
  const providedId = externalInquiryId == null ? '' : String(externalInquiryId).trim()
  if (channel !== 'rakuten') return providedId ? { externalId: providedId } : {}

  const inquiryNumbers = new Set<string>()
  collectInquiryNumbers(rawPayload, inquiryNumbers, new Set<object>())

  if (inquiryNumbers.size > 1) {
    return { reason: 'raw_payload contains multiple inquiryNumber values' }
  }

  const payloadInquiryNumber = inquiryNumbers.values().next().value as string | undefined
  const externalId = payloadInquiryNumber ?? providedId
  if (!externalId) return {}
  if (/^rakuten-(?:real-)?test-/i.test(externalId)) {
    return { reason: 'Rakuten external_inquiry_id must be the real inquiryNumber' }
  }

  return { externalId }
}

// 店舗/マーチャント側の返信者を示す値。これに該当する場合は CS 対応対象としない（open にしない）
const MERCHANT_SENDER_TYPES = new Set(['merchant', 'shop', 'store', 'seller'])

// is_completed=true → 履歴同期のみ、CS 対応対象にしない（resolved）
// last_reply_from が merchant 系 → open にしない（pending）
// それ以外 → open
function resolveInitialStatus(
  lastReplyFrom: string | null | undefined,
  isCompleted: boolean,
): 'open' | 'pending' | 'resolved' {
  if (isCompleted) return 'resolved'
  if (lastReplyFrom && MERCHANT_SENDER_TYPES.has(lastReplyFrom.toLowerCase())) return 'pending'
  return 'open'
}

export async function POST(req: NextRequest) {
  const configuredKey = process.env.CS_INTAKE_API_KEY?.trim()
  if (configuredKey) {
    const providedKey = req.headers.get('x-api-key')?.trim()
    if (providedKey !== configuredKey) {
      return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
    }
  }

  try {
    const body = await req.json()
    const {
      source_channel: rawChannel,
      external_inquiry_id,
      subject,
      body: bodyText,
      from_email,
      customer_name,
      order_number,
      received_at,
      raw_payload,
      replies,
      last_reply_from,
      is_completed,
    } = body

    if (!rawChannel || !bodyText) {
      return NextResponse.json(
        { ok: false, reason: 'source_channel and body are required' },
        { status: 400 }
      )
    }

    const channel = normalizeChannel(rawChannel)

    // トップレベルフィールドが未指定の場合は raw_payload から補完
    const rawPayloadMap = (raw_payload as Record<string, unknown>) ?? {}
    const resolvedIsCompleted: boolean =
      is_completed != null
        ? Boolean(is_completed)
        : Boolean(rawPayloadMap['isCompleted'])

    const resolvedLastReplyFrom: string | null = (() => {
      if (last_reply_from) return String(last_reply_from)
      const reps = rawPayloadMap['replies']
      if (!Array.isArray(reps) || reps.length === 0) return null
      const last = reps[reps.length - 1] as Record<string, unknown>
      return last?.['replyFrom'] ? String(last['replyFrom']) : null
    })()

    const resolvedExternalId = resolveExternalId(channel, external_inquiry_id, raw_payload)
    if (!resolvedExternalId.externalId) {
      return NextResponse.json(
        {
          ok: false,
          reason: resolvedExternalId.reason
            ?? 'external_inquiry_id is required (Rakuten must use inquiryNumber)',
        },
        { status: 400 }
      )
    }
    // 楽天は raw_payload の inquiryNumber を正として DB の external_id に保存する。
    const externalId = resolvedExternalId.externalId
    const supabase = createServiceClient()

    // 1. mall_id を取得
    const { data: mall } = await supabase
      .from('malls')
      .select('id')
      .eq('code', channel)
      .single()

    if (!mall) {
      return NextResponse.json(
        { ok: false, reason: 'mall_not_found', channel },
        { status: 422 }
      )
    }

    // 2. 既存 inquiry を確認（重複受信対策）
    const { data: existing } = await supabase
      .from('inquiries')
      .select('id, customer_profile_id, status')
      .eq('source_channel', channel)
      .eq('external_id', externalId)
      .maybeSingle()

    let inquiryId: string
    let isNew: boolean

    if (existing) {
      inquiryId = existing.id
      isNew = false

      // spam は上書きしない。resolved は原則保護するが、
      // 「お客様が再返信（isCompleted=false かつ last_reply_from=user）」の場合は open に戻す。
      const isCustomerReReply =
        existing.status === 'resolved' &&
        !resolvedIsCompleted &&
        resolvedLastReplyFrom != null &&
        !MERCHANT_SENDER_TYPES.has(resolvedLastReplyFrom.toLowerCase())

      const PROTECTED_STATUSES = new Set(['spam', ...(isCustomerReReply ? [] : ['resolved'])])
      const shouldUpdateStatus = !PROTECTED_STATUSES.has(existing.status ?? '')
      const newStatus = shouldUpdateStatus
        ? (isCustomerReReply ? 'open' : resolveInitialStatus(resolvedLastReplyFrom, resolvedIsCompleted))
        : undefined

      // raw_payload は常に最新化、status は条件付きで更新
      await supabase
        .from('inquiries')
        .update({
          ...(raw_payload != null ? { raw_payload } : {}),
          ...(newStatus !== undefined ? { status: newStatus } : {}),
        })
        .eq('id', inquiryId)
    } else {
      // 3. 新規 inquiry を INSERT
      // is_completed=true → resolved（履歴同期のみ、CS 対応対象にしない）
      // last_reply_from が merchant 系 → pending（open にしない）
      const initialStatus = resolveInitialStatus(resolvedLastReplyFrom, resolvedIsCompleted)
      const { data: inserted, error: insertErr } = await supabase
        .from('inquiries')
        .insert({
          mall_id: mall.id,
          source_channel: channel,
          external_id: externalId,
          subject: subject || null,
          customer_name: customer_name || null,
          order_number: order_number || null,
          received_at: received_at || new Date().toISOString(),
          raw_payload: raw_payload ?? null,
          status: initialStatus,
        })
        .select('id')
        .single()

      if (insertErr || !inserted) {
        return NextResponse.json(
          { ok: false, reason: 'inquiry_insert_failed', detail: insertErr?.message },
          { status: 500 }
        )
      }
      inquiryId = inserted.id
      isNew = true
    }

    // 4. replies[] を解決（ステップ4aの insert 判定に使うため先に計算）
    // replies が未指定の場合は raw_payload.replies を使う
    const repliesData: unknown[] = Array.isArray(replies)
      ? replies
      : Array.isArray((raw_payload as Record<string, unknown> | null)?.['replies'])
        ? ((raw_payload as Record<string, unknown>)['replies'] as unknown[])
        : []

    // 4a. 新規のみ: 受信メッセージを追加
    // repliesData がある場合は初回 body も replies に含まれているため、4b の同期に任せて二重登録を避ける
    if (isNew && repliesData.length === 0) {
      await supabase.from('inquiry_messages').insert({
        inquiry_id: inquiryId,
        direction: 'inbound',
        sender_type: 'customer',
        body: bodyText,
        sent_at: received_at || new Date().toISOString(),
        external_message_id: externalId ? `${externalId}::question` : null,
      })
    }

    // 4b. replies[] を inquiry_messages に同期（新規・既存どちらも、冪等）
    let repliesSyncError: string | null = null
    if (repliesData.length > 0 && externalId) {
      const replyRows = (repliesData as Array<{
        id?: number
        message?: string
        regDate?: string
        replyFrom?: string
      }>).map((r, idx) => {
        // replyFrom: 'user' → inbound/customer, 'merchant' → outbound/staff
        const isCustomer = r.replyFrom === 'user'
        return {
          inquiry_id: inquiryId,
          direction: (isCustomer ? 'inbound' : 'outbound') as 'inbound' | 'outbound',
          sender_type: (isCustomer ? 'customer' : 'staff') as 'customer' | 'staff',
          body: String(r.message ?? ''),
          sent_at: r.regDate ?? new Date().toISOString(),
          external_message_id: `${externalId}::${r.id ?? idx}`,
        }
      }).filter((r) => r.body.trim().length > 0)

      if (replyRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('inquiry_messages')
          .upsert(replyRows, { onConflict: 'inquiry_id,external_message_id', ignoreDuplicates: true })
        if (upsertErr) {
          console.error('[intake] replies upsert failed', upsertErr)
          repliesSyncError = upsertErr.message
        }
      }
    }

    // 5. customer_profile を解決（email → order_number の順で検索）
    // TODO: external_customer_key (楽天 masked_email 等) での検索も将来追加
    let customerProfileId: string | null = existing?.customer_profile_id ?? null

    if (!customerProfileId && from_email) {
      const normalizedEmail = (from_email as string).trim().toLowerCase()
      const { data: byEmail } = await supabase
        .from('customer_identities')
        .select('customer_profile_id')
        .eq('identifier_type', 'email')
        .eq('normalized_value', normalizedEmail)
        .maybeSingle()
      if (byEmail) customerProfileId = byEmail.customer_profile_id
    }

    if (!customerProfileId && order_number) {
      const { data: byOrder } = await supabase
        .from('customer_identities')
        .select('customer_profile_id')
        .eq('identifier_type', 'order_number')
        .eq('normalized_value', (order_number as string).trim())
        .maybeSingle()
      if (byOrder) customerProfileId = byOrder.customer_profile_id
    }

    // 6. 顧客が見つからなければ新規作成
    if (!customerProfileId) {
      const { data: newProfile, error: profileErr } = await supabase
        .from('customer_profiles')
        .insert({
          customer_name: customer_name ?? null,
          customer_email: from_email || null,
          primary_email: from_email ? (from_email as string).trim().toLowerCase() : null,
        })
        .select('id')
        .single()

      if (profileErr || !newProfile) {
        console.error('[intake] customer_profile insert failed', profileErr?.message)
      } else {
        customerProfileId = newProfile.id
      }
    }

    if (customerProfileId) {
      // 7. customer_identities へ登録（SELECT-then-INSERT、email と order_number のみ）
      if (from_email) {
        const normalizedEmail = (from_email as string).trim().toLowerCase()
        const { data: emailExists } = await supabase
          .from('customer_identities')
          .select('id')
          .eq('customer_profile_id', customerProfileId)
          .eq('identifier_type', 'email')
          .eq('normalized_value', normalizedEmail)
          .maybeSingle()

        if (!emailExists) {
          await supabase.from('customer_identities').insert({
            customer_profile_id: customerProfileId,
            channel,
            identifier_type: 'email',
            identifier_value: (from_email as string).trim(),
            normalized_value: normalizedEmail,
            confidence: 1.0,
            verified: false,
            source_inquiry_id: inquiryId,
          })
        }
      }

      if (order_number) {
        const normalizedOrder = (order_number as string).trim()
        const { data: orderExists } = await supabase
          .from('customer_identities')
          .select('id')
          .eq('customer_profile_id', customerProfileId)
          .eq('identifier_type', 'order_number')
          .eq('normalized_value', normalizedOrder)
          .maybeSingle()

        if (!orderExists) {
          await supabase.from('customer_identities').insert({
            customer_profile_id: customerProfileId,
            channel,
            identifier_type: 'order_number',
            identifier_value: normalizedOrder,
            normalized_value: normalizedOrder,
            confidence: 1.0,
            verified: false,
            source_inquiry_id: inquiryId,
          })
        }
      }

      // 8. inquiry に customer_profile_id をリンク
      await supabase
        .from('inquiries')
        .update({ customer_profile_id: customerProfileId })
        .eq('id', inquiryId)

      // 9. inquiry_count を再集計
      const { count: inquiryCount } = await supabase
        .from('inquiries')
        .select('*', { count: 'exact', head: true })
        .eq('customer_profile_id', customerProfileId)

      await supabase
        .from('customer_profiles')
        .update({ inquiry_count: inquiryCount ?? 0 })
        .eq('id', customerProfileId)
    }

    // 10. activity_log（新規のみ）
    if (isNew) {
      await supabase.from('activity_logs').insert({
        inquiry_id: inquiryId,
        actor_id: null,
        action: 'intake_received',
        after_val: { source_channel: channel, external_inquiry_id: externalId },
      })
    }

    // 11. find-order → orders テーブルへ保存（新規かつ order_number がある場合）
    if (isNew && order_number) {
      const proxyUrl = process.env.BOSS_API_PROXY_URL
      const apiKey = process.env.BOSS_PROXY_API_KEY
      if (proxyUrl) {
        waitUntil((async () => {
          try {
            const res = await fetch(`${proxyUrl}/api/boss/find-order`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'x-api-key': apiKey.trim() } : {}),
              },
              body: JSON.stringify({ mallOrderNumber: order_number }),
            })
            const data = await res.json()
            if (!data.ok || !data.order) return
            const o = data.order as {
              orderId: number | string
              mallOrderNumber: string | null
              orderStatus: string | null
              shipmentStatus: string | null
              carrier: string | null
              trackingNumber: string | null
              buyerName: string | null
              buyerEmail: string | null
              totalPrice: number | null
              mallOrderDateTime: string | null
              resultDeliveryDate: string | null
              address: string | null
              postalCode: string | null
              items: Array<{ itemName: string; skuCode: string; unitPrice: number | null; quantity: number | null }>
            }

            // rakuten mall_id を取得
            const { data: rakutenMall } = await supabase
              .from('malls')
              .select('id')
              .eq('code', 'rakuten')
              .maybeSingle()
            if (!rakutenMall) return

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const db = supabase as any
            const { data: upsertedOrder } = await db
              .from('orders')
              .upsert({
                source_channel: 'rakuten',
                external_order_id: String(o.orderId),
                order_number: o.mallOrderNumber ?? order_number,
                mall_id: rakutenMall.id,
                customer_profile_id: customerProfileId,
                ordered_at: o.mallOrderDateTime ?? new Date().toISOString(),
                total_amount: o.totalPrice ?? null,
                buyer_name: o.buyerName ?? null,
                buyer_email: o.buyerEmail ?? null,
                status: o.orderStatus ?? 'unknown',
                shipment_status: o.shipmentStatus ?? null,
                carrier: o.carrier ?? null,
                tracking_number: o.trackingNumber ?? null,
                delivery_date: o.resultDeliveryDate ?? null,
                buyer_address: o.address ?? null,
                buyer_postal_code: o.postalCode ?? null,
                raw_payload: o,
              }, { onConflict: 'source_channel,external_order_id' })
              .select('id')
              .single()

            if (!upsertedOrder?.id) return

            // items を保存（既存がなければ INSERT）
            if (o.items && o.items.length > 0) {
              const { count: existingCount } = await db
                .from('order_items')
                .select('*', { count: 'exact', head: true })
                .eq('order_id', upsertedOrder.id)
              if ((existingCount ?? 0) === 0) {
                await db.from('order_items').insert(
                  o.items.map((item: { itemName: string; skuCode: string; unitPrice: number | null; quantity: number | null }) => ({
                    order_id: upsertedOrder.id,
                    item_name: item.itemName ?? null,
                    sku: item.skuCode ?? null,
                    quantity: item.quantity ?? 1,
                    unit_price: item.unitPrice ?? null,
                  }))
                )
              }
            }
          } catch (e) {
            console.error('[intake] find-order/sync failed', e)
          }
        })())
      }
    }

    return NextResponse.json({
      ok: true,
      inquiry_id: inquiryId,
      customer_profile_id: customerProfileId,
      is_new: isNew,
      replies_synced: repliesData.length,
      ...(repliesSyncError ? { replies_sync_error: repliesSyncError } : {}),
    })
  } catch (e: unknown) {
    console.error('[intake]', e)
    const msg = e instanceof Error ? e.message : 'unknown_error'
    return NextResponse.json(
      { ok: false, reason: 'internal_error', message: msg },
      { status: 500 }
    )
  }
}

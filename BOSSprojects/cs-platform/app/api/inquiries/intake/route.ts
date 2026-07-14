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

const MERCHANT_SENDER_TYPES = new Set(['merchant', 'shop', 'store', 'seller'])

function resolveInitialStatus(
  lastReplyFrom: string | null | undefined,
  isCompleted: boolean,
): 'open' | 'pending' | 'resolved' {
  if (isCompleted) return 'resolved'
  if (lastReplyFrom && MERCHANT_SENDER_TYPES.has(lastReplyFrom.toLowerCase())) return 'pending'
  return 'open'
}

// =============================================
// システムメール判定
// =============================================
const SYSTEM_SENDER_PATTERNS = [
  /noreply@/i,
  /no-reply@/i,
  /notifications@/i,
  /@goqsystem\./i,
  /@github\.com$/i,
  /mailer-daemon@/i,
  /postmaster@/i,
]
const SYSTEM_SUBJECT_PATTERNS = [
  /楽天ランキング/,
  /ログイン通知/,
  /security vulnerabilities/i,
  /dependabot/i,
  /unsubscribe/i,
  /\[ビジネスID\]/,
  /Action required/i,
]

function isSystemEmail(from: string, subject: string): boolean {
  if (SYSTEM_SENDER_PATTERNS.some((p) => p.test(from))) return true
  if (SYSTEM_SUBJECT_PATTERNS.some((p) => p.test(subject))) return true
  return false
}

// "Display Name <email@example.com>" または "email@example.com" からアドレス部分を抽出
function extractEmailAddress(raw: string | null): string | null {
  if (!raw) return null
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1] : raw).trim().toLowerCase() || null
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
      // メール専用フィールド（email チャネルのみ使用）
      gmail_thread_id,
      gmail_message_id,
      rfc_message_id,
      direction: emailDirectionRaw,
      from: fromHeader,
      to: toHeader,
    } = body

    if (!rawChannel) {
      return NextResponse.json(
        { ok: false, reason: 'source_channel is required' },
        { status: 400 }
      )
    }

    const channel = normalizeChannel(rawChannel)

    // email チャネルは bodyText が空でも許容（添付のみのメール等）
    if (!bodyText && channel !== 'email') {
      return NextResponse.json(
        { ok: false, reason: 'body is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // mall_id を取得（全チャネル共通）
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

    // =============================================
    // メールチャネル専用処理
    // =============================================
    if (channel === 'email') {
      const gmailThreadId = typeof gmail_thread_id === 'string' ? gmail_thread_id.trim() : null
      const gmailMessageId = typeof gmail_message_id === 'string' ? gmail_message_id.trim() : null
      const rfcMessageId = typeof rfc_message_id === 'string' ? rfc_message_id.trim() : null
      const emailDirection: 'inbound' | 'outbound' = emailDirectionRaw === 'outbound' ? 'outbound' : 'inbound'
      const fromHeaderStr = typeof fromHeader === 'string' ? fromHeader.trim() : null
      const toHeaderStr = typeof toHeader === 'string' ? toHeader.trim() : null

      // inbound なら送信者が顧客、outbound なら宛先が顧客
      const customerEmailForProfile = emailDirection === 'inbound'
        ? extractEmailAddress(fromHeaderStr)
        : extractEmailAddress(toHeaderStr)

      // Step 1: システムメール判定（inquiry も messages も作らない）
      const fromForCheck = extractEmailAddress(fromHeaderStr) ?? fromHeaderStr ?? ''
      const subjectForCheck = typeof subject === 'string' ? subject : ''
      if (isSystemEmail(fromForCheck, subjectForCheck)) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'system_email' })
      }

      if (!gmailMessageId) {
        return NextResponse.json(
          { ok: false, reason: 'gmail_message_id is required for email channel' },
          { status: 400 }
        )
      }

      // Step 2: メッセージ重複チェック
      const { data: existingMsg } = await db
        .from('inquiry_messages')
        .select('id, inquiry_id')
        .eq('source_channel', 'email')
        .eq('external_message_id', gmailMessageId)
        .maybeSingle()

      if (existingMsg) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: 'duplicate_message_id',
          inquiry_id: existingMsg.inquiry_id,
        })
      }

      // Step 3: Thread ID で inquiry 検索
      let emailInquiry: { id: string; customer_profile_id: string | null; status: string } | null = null
      let isFoundByThread = false

      if (gmailThreadId) {
        const { data: byThread } = await db
          .from('inquiries')
          .select('id, customer_profile_id, status')
          .eq('source_channel', 'email')
          .eq('external_id', gmailThreadId)
          .maybeSingle() as { data: typeof emailInquiry }

        if (byThread) {
          emailInquiry = byThread
          isFoundByThread = true
        }
      }

      // Step 4: order_number フォールバック（候補が複数なら統合しない）
      if (!emailInquiry && order_number) {
        const { data: byOrder } = await db
          .from('inquiries')
          .select('id, customer_profile_id, status')
          .eq('source_channel', 'email')
          .eq('order_number', String(order_number).trim())
          .not('status', 'in', '("resolved","spam")')
          .gte('updated_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) as {
            data: Array<{ id: string; customer_profile_id: string | null; status: string }> | null
          }

        if (byOrder && byOrder.length === 1) {
          emailInquiry = byOrder[0]
        }
      }

      // Step 5: inquiry 作成（見つからない場合）
      let emailInquiryId: string
      let emailIsNew: boolean

      if (emailInquiry) {
        emailInquiryId = emailInquiry.id
        emailIsNew = false
      } else {
        const initialStatus = emailDirection === 'inbound' ? 'open' : 'pending'
        const { data: inserted, error: insertErr } = await supabase
          .from('inquiries')
          .insert({
            mall_id: mall.id,
            source_channel: 'email',
            external_id: gmailThreadId ?? gmailMessageId,
            subject: subject ? String(subject) : null,
            customer_name: customer_name ? String(customer_name) : null,
            order_number: order_number ? String(order_number).trim() : null,
            received_at: received_at ? String(received_at) : new Date().toISOString(),
            raw_payload: raw_payload ?? { gmail_thread_id: gmailThreadId, gmail_message_id: gmailMessageId },
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
        emailInquiryId = inserted.id
        emailIsNew = true
        emailInquiry = { id: emailInquiryId, customer_profile_id: null, status: initialStatus }
      }

      // Step 6: メッセージ保存
      const { error: msgErr } = await db.from('inquiry_messages').upsert(
        {
          inquiry_id: emailInquiryId,
          source_channel: 'email',
          external_message_id: gmailMessageId,
          direction: emailDirection,
          sender_type: emailDirection === 'inbound' ? 'customer' : 'staff',
          body: bodyText || '',
          sent_at: received_at ? String(received_at) : new Date().toISOString(),
          metadata: { rfc_message_id: rfcMessageId, from: fromHeaderStr, to: toHeaderStr },
        },
        { onConflict: 'source_channel,external_message_id', ignoreDuplicates: true }
      )
      if (msgErr) {
        console.error('[intake/email] message upsert failed', msgErr)
      }

      // Step 7: ステータス更新
      if (emailDirection === 'inbound' && emailInquiry.status === 'pending') {
        // 顧客が返信 → open に戻す
        await supabase.from('inquiries').update({ status: 'open' }).eq('id', emailInquiryId)
      } else if (
        emailDirection === 'outbound' &&
        emailInquiry.status === 'open' &&
        isFoundByThread
      ) {
        // スタッフ返信 → pending に変更するが、条件を確認する
        // (a) to が顧客メールアドレスと一致、(b) Thread ID で見つかった既存 inquiry
        const toEmail = extractEmailAddress(toHeaderStr)
        let savedCustomerEmail: string | null = null
        if (emailInquiry.customer_profile_id) {
          const { data: profile } = await db
            .from('customer_profiles')
            .select('customer_email')
            .eq('id', emailInquiry.customer_profile_id)
            .maybeSingle()
          savedCustomerEmail = profile?.customer_email
            ? String(profile.customer_email).toLowerCase()
            : null
        }
        if (toEmail && savedCustomerEmail && toEmail === savedCustomerEmail) {
          await supabase.from('inquiries').update({ status: 'pending' }).eq('id', emailInquiryId)
        }
      }

      // Steps 5-9（顧客プロフィール管理）
      let emailCustomerProfileId: string | null = emailInquiry.customer_profile_id ?? null

      if (!emailCustomerProfileId && customerEmailForProfile) {
        const { data: byEmail } = await supabase
          .from('customer_identities')
          .select('customer_profile_id')
          .eq('identifier_type', 'email')
          .eq('normalized_value', customerEmailForProfile)
          .maybeSingle()
        if (byEmail) emailCustomerProfileId = byEmail.customer_profile_id
      }

      if (!emailCustomerProfileId && order_number) {
        const { data: byOrd } = await supabase
          .from('customer_identities')
          .select('customer_profile_id')
          .eq('identifier_type', 'order_number')
          .eq('normalized_value', String(order_number).trim())
          .maybeSingle()
        if (byOrd) emailCustomerProfileId = byOrd.customer_profile_id
      }

      if (!emailCustomerProfileId) {
        const { data: newProfile, error: profileErr } = await supabase
          .from('customer_profiles')
          .insert({
            customer_name: customer_name ?? null,
            customer_email: customerEmailForProfile ?? null,
            primary_email: customerEmailForProfile ?? null,
          })
          .select('id')
          .single()

        if (profileErr || !newProfile) {
          console.error('[intake/email] customer_profile insert failed', profileErr?.message)
        } else {
          emailCustomerProfileId = newProfile.id
        }
      }

      if (emailCustomerProfileId) {
        if (customerEmailForProfile) {
          const { data: emailExists } = await supabase
            .from('customer_identities')
            .select('id')
            .eq('customer_profile_id', emailCustomerProfileId)
            .eq('identifier_type', 'email')
            .eq('normalized_value', customerEmailForProfile)
            .maybeSingle()

          if (!emailExists) {
            await supabase.from('customer_identities').insert({
              customer_profile_id: emailCustomerProfileId,
              channel: 'email',
              identifier_type: 'email',
              identifier_value: customerEmailForProfile,
              normalized_value: customerEmailForProfile,
              confidence: 1.0,
              verified: false,
              source_inquiry_id: emailInquiryId,
            })
          }
        }

        if (order_number) {
          const normalizedOrder = String(order_number).trim()
          const { data: orderExists } = await supabase
            .from('customer_identities')
            .select('id')
            .eq('customer_profile_id', emailCustomerProfileId)
            .eq('identifier_type', 'order_number')
            .eq('normalized_value', normalizedOrder)
            .maybeSingle()

          if (!orderExists) {
            await supabase.from('customer_identities').insert({
              customer_profile_id: emailCustomerProfileId,
              channel: 'email',
              identifier_type: 'order_number',
              identifier_value: normalizedOrder,
              normalized_value: normalizedOrder,
              confidence: 1.0,
              verified: false,
              source_inquiry_id: emailInquiryId,
            })
          }
        }

        await supabase
          .from('inquiries')
          .update({ customer_profile_id: emailCustomerProfileId })
          .eq('id', emailInquiryId)

        const { count: inquiryCount } = await supabase
          .from('inquiries')
          .select('*', { count: 'exact', head: true })
          .eq('customer_profile_id', emailCustomerProfileId)

        await supabase
          .from('customer_profiles')
          .update({ inquiry_count: inquiryCount ?? 0 })
          .eq('id', emailCustomerProfileId)
      }

      if (emailIsNew) {
        await supabase.from('activity_logs').insert({
          inquiry_id: emailInquiryId,
          actor_id: null,
          action: 'intake_received',
          after_val: { source_channel: 'email', gmail_thread_id: gmailThreadId, gmail_message_id: gmailMessageId },
        })
      }

      return NextResponse.json({
        ok: true,
        inquiry_id: emailInquiryId,
        customer_profile_id: emailCustomerProfileId,
        is_new: emailIsNew,
      })
    }

    // =============================================
    // 楽天・その他チャネル（既存処理）
    // =============================================

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

    if (!bodyText) {
      return NextResponse.json(
        { ok: false, reason: 'body is required' },
        { status: 400 }
      )
    }

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
    const externalId = resolvedExternalId.externalId

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

      await supabase
        .from('inquiries')
        .update({
          ...(raw_payload != null ? { raw_payload } : {}),
          ...(newStatus !== undefined ? { status: newStatus } : {}),
        })
        .eq('id', inquiryId)
    } else {
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

    // 4. replies[] を解決
    const repliesData: unknown[] = Array.isArray(replies)
      ? replies
      : Array.isArray((raw_payload as Record<string, unknown> | null)?.['replies'])
        ? ((raw_payload as Record<string, unknown>)['replies'] as unknown[])
        : []

    // 4a. 新規のみ: 受信メッセージを追加
    if (isNew && repliesData.length === 0) {
      await db.from('inquiry_messages').insert({
        inquiry_id: inquiryId,
        source_channel: channel,
        direction: 'inbound',
        sender_type: 'customer',
        body: bodyText,
        sent_at: received_at || new Date().toISOString(),
        external_message_id: externalId ? `${externalId}::question` : null,
      })
    }

    // 4b. replies[] を inquiry_messages に同期（冪等）
    let repliesSyncError: string | null = null
    if (repliesData.length > 0 && externalId) {
      const replyRows = (repliesData as Array<{
        id?: number
        message?: string
        regDate?: string
        replyFrom?: string
      }>).map((r, idx) => {
        const isCustomer = r.replyFrom === 'user'
        return {
          inquiry_id: inquiryId,
          source_channel: channel,
          direction: (isCustomer ? 'inbound' : 'outbound') as 'inbound' | 'outbound',
          sender_type: (isCustomer ? 'customer' : 'staff') as 'customer' | 'staff',
          body: String(r.message ?? ''),
          sent_at: r.regDate ?? new Date().toISOString(),
          external_message_id: `${externalId}::${r.id ?? idx}`,
        }
      }).filter((r) => r.body.trim().length > 0)

      if (replyRows.length > 0) {
        const { error: upsertErr } = await db
          .from('inquiry_messages')
          .upsert(replyRows, { onConflict: 'source_channel,external_message_id', ignoreDuplicates: true })
        if (upsertErr) {
          console.error('[intake] replies upsert failed', upsertErr)
          repliesSyncError = upsertErr.message
        }
      }
    }

    // 5. customer_profile を解決（email → order_number の順で検索）
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
      // 7. customer_identities へ登録
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

            const { data: rakutenMall } = await supabase
              .from('malls')
              .select('id')
              .eq('code', 'rakuten')
              .maybeSingle()
            if (!rakutenMall) return

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

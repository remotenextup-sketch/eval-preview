export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type RakutenReply = {
  id?: number
  message?: string
  regDate?: string
  replyFrom?: string
}

const MERCHANT_SENDER_TYPES = new Set(['merchant', 'shop', 'store', 'seller'])

function deriveStatusFromPayload(payload: Record<string, unknown>): 'open' | 'pending' | 'resolved' {
  if (Boolean(payload['isCompleted'])) return 'resolved'
  const replies = payload['replies']
  if (Array.isArray(replies) && replies.length > 0) {
    const last = replies[replies.length - 1] as Record<string, unknown>
    const replyFrom = last?.['replyFrom'] ? String(last['replyFrom']).toLowerCase() : ''
    if (MERCHANT_SENDER_TYPES.has(replyFrom)) return 'pending'
  }
  return 'open'
}

/**
 * POST /api/inquiries/resync-replies
 *
 * 既存 inquiries の raw_payload.replies を inquiry_messages に再同期する。
 * GAS を再実行せず DB 内データだけで backfill したい場合に使用。
 *
 * Body (optional):
 *   { external_ids?: string[] }  // 指定した場合はその inquiry のみ対象
 */
export async function POST(req: NextRequest) {
  const configuredKey = process.env.CS_INTAKE_API_KEY?.trim()
  if (configuredKey) {
    const providedKey = req.headers.get('x-api-key')?.trim()
    if (providedKey !== configuredKey) {
      return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
    }
  }

  const body = await req.json().catch(() => ({}))
  const targetExternalIds: string[] | undefined =
    Array.isArray(body?.external_ids) ? body.external_ids : undefined

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // 対象 inquiry を取得（raw_payload.replies が非空配列のもの）
  let query = supabase
    .from('inquiries')
    .select('id, external_id, status, raw_payload')
    .not('raw_payload', 'is', null)
    .eq('source_channel', 'rakuten')

  if (targetExternalIds && targetExternalIds.length > 0) {
    query = query.in('external_id', targetExternalIds)
  }

  const { data: inquiries, error: fetchErr } = await query
  if (fetchErr) {
    return NextResponse.json({ ok: false, reason: fetchErr.message }, { status: 500 })
  }

  const results: Array<{
    external_id: string | null
    synced: number
    skipped: number
    status_updated: boolean
    error: string | null
  }> = []

  for (const inq of inquiries ?? []) {
    const rawPayload = inq.raw_payload as Record<string, unknown> | null
    if (!inq.external_id || !rawPayload) continue

    const externalId = inq.external_id
    const repliesRaw = rawPayload?.['replies']
    const replies = Array.isArray(repliesRaw) ? (repliesRaw as RakutenReply[]) : []

    // replies を inquiry_messages に同期
    let synced = 0
    let upsertError: string | null = null

    if (replies.length > 0) {
      const replyRows = replies.map((r, idx) => {
        const isCustomer = r.replyFrom === 'user'
        return {
          inquiry_id: inq.id,
          source_channel: 'rakuten' as const,
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
          console.error('[resync-replies] upsert failed', inq.external_id, upsertErr)
          upsertError = upsertErr.message
        } else {
          synced = replyRows.length
        }
      }
    }

    // raw_payload から status を再導出して更新（resolved/spam は保護）
    const PROTECTED = new Set(['resolved', 'spam'])
    let statusUpdated = false
    if (!PROTECTED.has(inq.status ?? '')) {
      const derivedStatus = deriveStatusFromPayload(rawPayload)
      if (derivedStatus !== inq.status) {
        await supabase
          .from('inquiries')
          .update({ status: derivedStatus })
          .eq('id', inq.id)
        statusUpdated = true
      }
    }

    results.push({
      external_id: inq.external_id,
      synced,
      skipped: replies.length - synced,
      status_updated: statusUpdated,
      error: upsertError,
    })
  }

  const totalSynced        = results.reduce((s, r) => s + r.synced, 0)
  const totalStatusUpdated = results.filter((r) => r.status_updated).length
  const errorCount         = results.filter((r) => r.error).length

  return NextResponse.json({
    ok: errorCount === 0,
    total_inquiries: results.length,
    total_synced: totalSynced,
    total_status_updated: totalStatusUpdated,
    error_count: errorCount,
    results,
  })
}

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
    const { inquiry_id, category, summary, is_angry, needs_human, reply_body, action } = body

    if (!inquiry_id) {
      return NextResponse.json({ ok: false, reason: 'inquiry_id required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // inquiry_id 存在確認 + source_channel 取得
    const { data: exists, error: existsErr } = await supabase
      .from('inquiries')
      .select('id, source_channel')
      .eq('id', inquiry_id)
      .maybeSingle()

    if (existsErr) {
      return NextResponse.json(
        { ok: false, reason: 'db_error', detail: existsErr.message },
        { status: 500 }
      )
    }
    if (!exists) {
      return NextResponse.json({ ok: false, reason: 'inquiry_not_found' }, { status: 404 })
    }

    // 楽天は AUTO_REPLY でも人が確認するため常に needs_human=true
    const resolvedNeedsHuman =
      exists.source_channel === 'rakuten'
        ? true
        : needs_human === true || needs_human === 'true'

    // Step 1: AI分類結果を inquiry に保存
    const { error: updateErr } = await supabase
      .from('inquiries')
      .update({
        ai_intent: category ?? null,
        ai_action: action ?? null,
        is_angry: is_angry === true || is_angry === 'true',
        needs_human: resolvedNeedsHuman,
      })
      .eq('id', inquiry_id)

    if (updateErr) {
      return NextResponse.json(
        { ok: false, reason: 'inquiry_update_failed', detail: updateErr.message },
        { status: 500 }
      )
    }

    // Step 2: AI下書きを ai_logs に保存（inquiry_messages には保存しない）
    let draftCreated = false
    let skippedReason: string | undefined

    if (reply_body && action !== 'noop') {
      // 未フィードバックの open draft が既に存在する場合はスキップ（二重生成防止）
      const { count: openDraftCount } = await supabase
        .from('ai_logs')
        .select('*', { count: 'exact', head: true })
        .eq('inquiry_id', inquiry_id)
        .eq('action_type', 'draft')
        .is('feedback', null)
        .not('result', 'is', null)

      if (openDraftCount && openDraftCount > 0) {
        skippedReason = 'existing_open_draft'
      } else {
        const { error: aiLogErr } = await supabase.from('ai_logs').insert({
          inquiry_id,
          action_type: 'draft',
          model: 'dify-gpt-4o-mini',
          result: { draft: reply_body, category, summary, action },
          confidence: 0.80,
          latency_ms: null,
        })

        if (aiLogErr) {
          console.error('[save-ai-result] ai_logs insert failed', aiLogErr.message)
        } else {
          draftCreated = true
        }
      }
    }

    // Step 3: activity_log（失敗しても 500 にしない）
    try {
      await supabase.from('activity_logs').insert({
        inquiry_id,
        actor_id: null,
        action: 'ai_draft_generated',
        after_val: { category, summary, action, draft_created: draftCreated },
      })
    } catch (logErr) {
      console.warn('[save-ai-result] activity_log failed', logErr)
    }

    return NextResponse.json({
      ok: true,
      inquiry_id,
      draft_created: draftCreated,
      ...(skippedReason ? { skipped_reason: skippedReason } : {}),
    })
  } catch (e: unknown) {
    console.error('[save-ai-result]', e)
    const msg = e instanceof Error ? e.message : 'unknown_error'
    return NextResponse.json(
      { ok: false, reason: 'internal_error', message: msg },
      { status: 500 }
    )
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type { InquiryStatus, AiLogFeedback } from '@/lib/types'

function createKnowledgeClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function extractKeywords(text: string): string[] {
  return [...new Set(
    (text.match(/[぀-ヿ一-龯]{2,}/g) ?? []).slice(0, 6)
  )]
}

function tomorrowAt8amJST(): string {
  const JST = 9 * 60 * 60 * 1000
  const nowJST = Date.now() + JST
  const todayMidnightJST = nowJST - (nowJST % (24 * 60 * 60 * 1000))
  return new Date(todayMidnightJST + (24 + 8) * 60 * 60 * 1000 - JST).toISOString()
}

async function nextBusinessMondayAt8amJST(): Promise<string> {
  const JST = 9 * 60 * 60 * 1000
  const nowJST = Date.now() + JST
  const todayMidnightJST = nowJST - (nowJST % (24 * 60 * 60 * 1000))
  const dayOfWeek = new Date(nowJST).getUTCDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  let targetMidnightJST = todayMidnightJST + daysUntilMonday * 24 * 60 * 60 * 1000

  // 祝日チェック（失敗時は月曜のまま）
  try {
    const res = await fetch('https://holidays-jp.github.io/api/v1/date.json')
    if (res.ok) {
      const holidays: Record<string, string> = await res.json()
      for (let i = 0; i < 7; i++) {
        const dateStr = new Date(targetMidnightJST).toISOString().slice(0, 10)
        const dow = new Date(targetMidnightJST).getUTCDay()
        if (dow !== 0 && dow !== 6 && !holidays[dateStr]) break
        targetMidnightJST += 24 * 60 * 60 * 1000
      }
    }
  } catch {
    // API失敗 → そのまま月曜
  }

  return new Date(targetMidnightJST + 8 * 60 * 60 * 1000 - JST).toISOString()
}

export async function updateStatus(inquiryId: string, status: InquiryStatus, snooze?: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: current } = await supabase
    .from('inquiries')
    .select('status')
    .eq('id', inquiryId)
    .single()

  const releaseLock = status === 'pending' || status === 'resolved'

  await supabase.from('inquiries').update({
    status,
    resolved_at: status === 'resolved' ? new Date().toISOString() : null,
    snooze_until: snooze && status === 'pending' ? tomorrowAt8amJST() : null,
    ...(releaseLock ? { locked_by: null, locked_at: null } : {}),
  }).eq('id', inquiryId)

  if (releaseLock) {
    const reason = status === 'pending' ? 'status_pending' : 'status_resolved'
    await supabase.from('activity_logs').insert({
      inquiry_id: inquiryId,
      actor_id: user.id,
      action: 'unlocked',
      before_val: null,
      after_val: { reason },
    })
  }

  if (current) {
    await supabase.from('activity_logs').insert({
      inquiry_id: inquiryId,
      actor_id: user.id,
      action: 'status_changed',
      before_val: { status: current.status },
      after_val: { status },
    })
  }

  revalidatePath(`/inbox/${inquiryId}`)
  revalidatePath('/inbox')
}

export async function sendReply(
  inquiryId: string,
  body: string,
  statusAction: 'only' | 'pending' | 'pending_tomorrow' | 'pending_monday' | 'resolved' = 'only',
  isAiDraft = false,
  aiModified = false,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラー' }

  const { data: inq } = await supabase
    .from('inquiries')
    .select('source_channel, external_id, item_name, raw_payload')
    .eq('id', inquiryId)
    .single()

  if (!inq) return { error: '問い合わせが見つかりません' }

  if (inq.source_channel === 'rakuten') {
    if (!inq.external_id) {
      return { error: '楽天の問い合わせ番号が取得できません' }
    }

    const proxyUrl = process.env.BOSS_API_PROXY_URL
    const proxyKey = process.env.BOSS_PROXY_API_KEY
    if (!proxyUrl) return { error: 'BOSS_API_PROXY_URL が設定されていません' }

    let proxyRes: Response
    try {
      proxyRes = await fetch(`${proxyUrl}/api/boss/inquiry/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(proxyKey ? { 'x-api-key': proxyKey } : {}),
        },
        body: JSON.stringify({ inquiryNumber: inq.external_id, message: body, dryRun: true }),
      })
    } catch (e) {
      return { error: `楽天返信プロキシへの接続に失敗しました: ${e instanceof Error ? e.message : '不明なエラー'}` }
    }

    let proxyData: { ok: boolean; reason?: string; payload?: Record<string, unknown> }
    try {
      proxyData = await proxyRes.json()
    } catch {
      return { error: `楽天返信プロキシのレスポンスが不正です (HTTP ${proxyRes.status})` }
    }

    if (!proxyData.ok) {
      return { error: `楽天返信エラー: ${proxyData.reason ?? `HTTP ${proxyRes.status}`}` }
    }

    await supabase.from('inquiry_messages').insert({
      inquiry_id: inquiryId,
      direction: 'outbound',
      sender_type: 'staff',
      sender_id: user.id,
      body,
      is_ai_draft: isAiDraft,
      ai_modified: isAiDraft && aiModified,
    })

    await supabase.from('activity_logs').insert({
      inquiry_id: inquiryId,
      actor_id: user.id,
      action: 'rakuten_reply_dry_run',
      before_val: null,
      after_val: (proxyData.payload ?? null) as unknown as import('@/lib/types').Json,
    })

    await supabase.from('activity_logs').insert({
      inquiry_id: inquiryId,
      actor_id: user.id,
      action: 'replied',
      before_val: null,
      after_val: null,
    })
  } else {
    await supabase.from('inquiry_messages').insert({
      inquiry_id: inquiryId,
      direction: 'outbound',
      sender_type: 'staff',
      sender_id: user.id,
      body,
      is_ai_draft: isAiDraft,
      ai_modified: isAiDraft && aiModified,
    })

    await supabase.from('activity_logs').insert({
      inquiry_id: inquiryId,
      actor_id: user.id,
      action: 'replied',
      before_val: null,
      after_val: null,
    })
  }

  if (statusAction !== 'only') {
    const status: InquiryStatus = (statusAction === 'pending_monday' || statusAction === 'pending_tomorrow') ? 'pending' : statusAction
    const snoozeUntil = statusAction === 'pending_monday' ? await nextBusinessMondayAt8amJST()
      : statusAction === 'pending_tomorrow' ? tomorrowAt8amJST()
      : null
    const { data: current } = await supabase
      .from('inquiries')
      .select('status')
      .eq('id', inquiryId)
      .single()

    await supabase.from('inquiries').update({
      status,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      snooze_until: snoozeUntil,
      locked_by: null,
      locked_at: null,
    }).eq('id', inquiryId)

    const reason = status === 'pending' ? 'reply_pending' : 'reply_resolved'
    await supabase.from('activity_logs').insert({
      inquiry_id: inquiryId,
      actor_id: user.id,
      action: 'unlocked',
      before_val: null,
      after_val: { reason },
    })

    if (current) {
      await supabase.from('activity_logs').insert({
        inquiry_id: inquiryId,
        actor_id: user.id,
        action: 'status_changed',
        before_val: { status: current.status },
        after_val: { status },
      })
    }
  }

  revalidatePath(`/inbox/${inquiryId}`)
  revalidatePath('/inbox')

  // knowledge_cases 自動保存（失敗しても sendReply を止めない）
  try {
    const rawPayload = inq.raw_payload as Record<string, unknown> | null
    const question = typeof rawPayload?.message === 'string' ? rawPayload.message : null

    let kcSource: string
    let kcConfidence: number
    let kcStatus: string
    if (isAiDraft && !aiModified) {
      kcSource = 'auto'; kcConfidence = 0.7; kcStatus = 'candidate'
    } else if (isAiDraft && aiModified) {
      kcSource = 'auto_edited'; kcConfidence = 0.85; kcStatus = 'active'
    } else {
      kcSource = 'manual'; kcConfidence = 0.9; kcStatus = 'active'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createKnowledgeClient() as any).from('knowledge_cases').insert({
      product_name: inq.item_name ?? null,
      question,
      answer: body,
      reply_body: body,
      source: kcSource,
      confidence: kcConfidence,
      status: kcStatus,
      needs_sync: false,
    })
  } catch (e) {
    console.error('[sendReply] knowledge_cases auto-save failed:', e)
  }

  return {}
}

export async function acquireLock(
  inquiryId: string,
): Promise<{ success: true } | { success: false; lockedByName: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, lockedByName: '不明なユーザー' }

  const { data, error } = await supabase.rpc('try_acquire_inquiry_lock', {
    p_inquiry_id: inquiryId,
    p_user_id: user.id,
  })

  if (error || !data) return { success: false, lockedByName: '不明なユーザー' }

  const result = data as { acquired: boolean; was_expired: boolean; prev_locked_by: string | null }

  if (result.acquired) {
    if (result.was_expired && result.prev_locked_by) {
      await supabase.from('activity_logs').insert({
        inquiry_id: inquiryId,
        actor_id: user.id,
        action: 'lock_expired',
        before_val: { locked_by: result.prev_locked_by },
        after_val: { locked_by: user.id },
      })
    }
    await supabase.from('activity_logs').insert({
      inquiry_id: inquiryId,
      actor_id: user.id,
      action: 'locked',
      before_val: null,
      after_val: { locked_by: user.id },
    })
    revalidatePath(`/inbox/${inquiryId}`)
    return { success: true }
  }

  const { data: inq } = await supabase
    .from('inquiries')
    .select('locked_by')
    .eq('id', inquiryId)
    .single()

  const { data: holder } = inq?.locked_by
    ? await supabase.from('users').select('display_name').eq('id', inq.locked_by).single()
    : { data: null }

  return { success: false, lockedByName: holder?.display_name ?? '他のユーザー' }
}

export async function releaseLock(inquiryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data } = await supabase
    .from('inquiries')
    .update({ locked_by: null, locked_at: null })
    .eq('id', inquiryId)
    .eq('locked_by', user.id)
    .select('id')
    .single()

  if (!data) return

  await supabase.from('activity_logs').insert({
    inquiry_id: inquiryId,
    actor_id: user.id,
    action: 'unlocked',
    before_val: { locked_by: user.id },
    after_val: null,
  })

  revalidatePath(`/inbox/${inquiryId}`)
}

export async function updateAssignee(inquiryId: string, assigneeId: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('inquiries')
    .update({ assignee_id: assigneeId })
    .eq('id', inquiryId)

  await supabase.from('activity_logs').insert({
    inquiry_id: inquiryId,
    actor_id: user.id,
    action: 'assigned',
    before_val: null,
    after_val: { assignee_id: assigneeId },
  })

  revalidatePath(`/inbox/${inquiryId}`)
  revalidatePath('/inbox')
}

export async function addComment(inquiryId: string, body: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('comments').insert({
    inquiry_id: inquiryId,
    author_id: user.id,
    body,
  })

  await supabase.from('activity_logs').insert({
    inquiry_id: inquiryId,
    actor_id: user.id,
    action: 'commented',
    before_val: null,
    after_val: null,
  })

  revalidatePath(`/inbox/${inquiryId}`)
}

export async function generateAiDraft(inquiryId: string): Promise<{ draft: string; aiLogId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラー' }

  const startedAt = Date.now()

  // 1. inquiry 基本情報 + 最初のインバウンドメッセージ
  const [{ data: inq }, { data: firstMsg }] = await Promise.all([
    supabase
      .from('inquiries')
      .select('ai_intent, customer_name, source_channel, order_number, subject')
      .eq('id', inquiryId)
      .single(),
    supabase
      .from('inquiry_messages')
      .select('body')
      .eq('inquiry_id', inquiryId)
      .eq('direction', 'inbound')
      .order('sent_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  if (!inq) return { error: '問い合わせが見つかりません' }

  const questionText = firstMsg?.body ?? inq.subject ?? ''
  const keywords = extractKeywords(questionText)
  const mainKeyword = keywords[0] ?? ''
  const customerName = inq.customer_name ?? 'お客様'
  const salutation = `${customerName} 様\n\n`

  // 2. knowledge_cases / knowledge_templates をキーワード検索
  type KnowledgeCase     = { product_name: string | null; question: string | null; reply_body: string | null }
  type KnowledgeTemplate = { phrase: string | null; body: string | null }
  let matchedCase:     KnowledgeCase     | null = null
  let matchedTemplate: KnowledgeTemplate | null = null

  if (mainKeyword) {
    const kb = createKnowledgeClient()
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kba = kb as any

      // status='active' 優先 → なければ全件、ORDER BY confidence DESC, success_count DESC, updated_at DESC
      async function searchCase(col: string, keyword: string): Promise<KnowledgeCase | null> {
        const base = kba.from('knowledge_cases')
          .select('product_name, question, reply_body')
          .ilike(col, `%${keyword}%`)
          .not('reply_body', 'is', null)
        const active = await base
          .eq('status', 'active')
          .order('confidence', { ascending: false })
          .order('success_count', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1)
        if (active.data?.[0]) return active.data[0]
        const all = await kba.from('knowledge_cases')
          .select('product_name, question, reply_body')
          .ilike(col, `%${keyword}%`)
          .not('reply_body', 'is', null)
          .order('confidence', { ascending: false })
          .order('success_count', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1)
        return all.data?.[0] ?? null
      }

      // knowledge_cases: question → answer → product_name の優先順で検索
      matchedCase = await searchCase('question', mainKeyword)
      if (!matchedCase) matchedCase = await searchCase('answer', mainKeyword)
      if (!matchedCase) matchedCase = await searchCase('product_name', mainKeyword)

      // knowledge_templates: synonyms → phrase の優先順で検索
      const tmplBySynonyms = await kba.from('knowledge_templates')
        .select('phrase, body')
        .ilike('synonyms', `%${mainKeyword}%`)
        .limit(1)
      matchedTemplate = tmplBySynonyms.data?.[0] ?? null

      if (!matchedTemplate) {
        const tmplByPhrase = await kba.from('knowledge_templates')
          .select('phrase, body')
          .ilike('phrase', `%${mainKeyword}%`)
          .limit(1)
        matchedTemplate = tmplByPhrase.data?.[0] ?? null
      }
    } catch (e) {
      console.error('[generateAiDraft] knowledge search error:', e)
    }
  }

  // 3. 返信案の組み立て
  let draft = ''

  if (matchedCase?.reply_body) {
    draft = `${salutation}${matchedCase.reply_body}`
  } else if (matchedTemplate?.body) {
    draft = `${salutation}${matchedTemplate.body}`
  } else {
    // フォールバック: 既存 knowledge テーブル（intentマッチング）
    if (inq.ai_intent) {
      const { data: legacyKb } = await supabase
        .from('knowledge')
        .select('answer_template')
        .eq('intent', inq.ai_intent)
        .eq('is_active', true)
        .order('quality_score', { ascending: false })
        .limit(1)
        .single()

      if (legacyKb) {
        draft = `${salutation}${legacyKb.answer_template.replace(/\{\{customer_name\}\}/g, customerName)}`
      }
    }

    if (!draft) {
      draft = `${salutation}お問い合わせいただきありがとうございます。\nご連絡の内容を確認し、担当者より改めてご連絡いたします。\n\nどうぞよろしくお願いいたします。`
    }
  }

  draft = `${draft}\n\nカスタマー担当`

  // 4. ai_logs 保存（失敗しても下書きは返す）
  const aiLogId = crypto.randomUUID()
  const matched = matchedCase ? 'case' : matchedTemplate ? 'template' : 'fallback'
  try {
    await supabase.from('ai_logs').insert({
      id: aiLogId,
      inquiry_id: inquiryId,
      action_type: 'draft',
      model: 'knowledge-v2',
      prompt_tokens: null,
      completion_tokens: null,
      result: {
        draft,
        matched,
        keyword: mainKeyword || null,
        case_question: matchedCase?.question ?? null,
        template_phrase: matchedTemplate?.phrase ?? null,
      },
      confidence: matchedCase ? 0.80 : matchedTemplate ? 0.65 : 0.40,
      latency_ms: Date.now() - startedAt,
    })
    await supabase.from('activity_logs').insert({
      inquiry_id: inquiryId,
      actor_id: user.id,
      action: 'ai_draft_generated',
      before_val: null,
      after_val: { ai_log_id: aiLogId, model: 'knowledge-v2', matched, keyword: mainKeyword || null },
    })
  } catch (logErr) {
    console.error('[generateAiDraft] ai_logs insert error:', logErr)
  }

  revalidatePath(`/inbox/${inquiryId}`)
  return { draft, aiLogId }
}

export async function scheduleReply(
  inquiryId: string,
  body: string,
  scheduledAt: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラー' }

  const { error } = await supabase
    .from('inquiries')
    .update({
      scheduled_reply_body: body,
      scheduled_reply_at: scheduledAt,
    })
    .eq('id', inquiryId)

  if (error) return { error: error.message }

  await supabase.from('activity_logs').insert({
    inquiry_id: inquiryId,
    actor_id: user.id,
    action: 'scheduled_reply',
    before_val: null,
    after_val: { scheduled_at: scheduledAt },
  })

  revalidatePath(`/inbox/${inquiryId}`)
  revalidatePath('/inbox')
  return {}
}

export async function submitAiDraftFeedback(
  inquiryId: string,
  aiLogId: string,
  feedback: AiLogFeedback,
  options?: { editedBody?: string },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: aiLog } = await supabase
    .from('ai_logs')
    .select('result')
    .eq('id', aiLogId)
    .single()

  const updateData: { feedback: AiLogFeedback; feedback_at: string; result?: import('@/lib/types').Json } = {
    feedback,
    feedback_at: new Date().toISOString(),
  }

  if (feedback === 'edited' && options?.editedBody !== undefined) {
    updateData.result = {
      ...(typeof aiLog?.result === 'object' && aiLog.result ? aiLog.result as Record<string, unknown> : {}),
      draft: options.editedBody,
    } as import('@/lib/types').Json
  }

  await supabase.from('ai_logs').update(updateData).eq('id', aiLogId)

  const actionMap: Record<AiLogFeedback, string> = {
    accepted: 'ai_draft_accepted',
    edited: 'ai_draft_edited',
    rejected: 'ai_draft_edited',
  }

  await supabase.from('activity_logs').insert({
    inquiry_id: inquiryId,
    actor_id: user.id,
    action: actionMap[feedback],
    before_val: null,
    after_val: { ai_log_id: aiLogId, feedback },
  })

  // increment knowledge success_count if accepted and knowledge was used
  if (feedback === 'accepted' && aiLog?.result) {
    const knowledgeId = (aiLog.result as Record<string, unknown>).knowledge_id as string | null
    if (knowledgeId) {
      const { data: kb } = await supabase
        .from('knowledge')
        .select('success_count')
        .eq('id', knowledgeId)
        .single()
      if (kb) {
        await supabase.from('knowledge').update({
          success_count: kb.success_count + 1,
        }).eq('id', knowledgeId)
      }
    }
  }

  revalidatePath(`/inbox/${inquiryId}`)
}

export async function addTag(inquiryId: string, tagId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('inquiry_tags').insert({ inquiry_id: inquiryId, tag_id: tagId })

  await supabase.from('activity_logs').insert({
    inquiry_id: inquiryId,
    actor_id: user.id,
    action: 'tag_added',
    before_val: null,
    after_val: { tag_id: tagId },
  })

  revalidatePath(`/inbox/${inquiryId}`)
}

export async function removeTag(inquiryId: string, tagId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('inquiry_tags')
    .delete()
    .eq('inquiry_id', inquiryId)
    .eq('tag_id', tagId)

  await supabase.from('activity_logs').insert({
    inquiry_id: inquiryId,
    actor_id: user.id,
    action: 'tag_removed',
    before_val: null,
    after_val: { tag_id: tagId },
  })

  revalidatePath(`/inbox/${inquiryId}`)
}

export async function addToKnowledgeCases(
  inquiryMessageId: string,
  inquiryId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラー' }

  const [{ data: msg }, { data: inq }] = await Promise.all([
    supabase.from('inquiry_messages').select('body').eq('id', inquiryMessageId).single(),
    supabase.from('inquiries').select('item_name, raw_payload').eq('id', inquiryId).single(),
  ])

  if (!msg) return { error: 'メッセージが見つかりません' }

  const rawPayload = inq?.raw_payload as Record<string, unknown> | null
  const question = (typeof rawPayload?.message === 'string' ? rawPayload.message : null)

  const { error } = await createKnowledgeClient()
    .from('knowledge_cases')
    .insert({
      product_name: inq?.item_name ?? null,
      question,
      answer: msg.body,
      reply_body: msg.body,
      source: 'manual',
    })

  if (error) return { error: error.message }
  return {}
}

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
    .select('source_channel, external_id, item_name, raw_payload, order_number, customer_name, subject, customer_profile_id')
    .eq('id', inquiryId)
    .single()

  if (!inq) return { error: '問い合わせが見つかりません' }

  let savedMessageId: string | null = null

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
        body: JSON.stringify({
          inquiryNumber: inq.external_id,
          message: body,
          dryRun: false,
          complete: statusAction !== 'pending_tomorrow' && statusAction !== 'pending_monday',
        }),
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

    const { data: rakutenMsg } = await supabase.from('inquiry_messages').insert({
      inquiry_id: inquiryId,
      direction: 'outbound',
      sender_type: 'staff',
      sender_id: user.id,
      body,
      is_ai_draft: isAiDraft,
      ai_modified: isAiDraft && aiModified,
    }).select('id').single()
    savedMessageId = rakutenMsg?.id ?? null

    await supabase.from('activity_logs').insert({
      inquiry_id: inquiryId,
      actor_id: user.id,
      action: 'rakuten_reply_sent',
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
  } else if (inq.source_channel === 'email') {
    // メール送信
    let customerEmail: string | null = null
    if (inq.customer_profile_id) {
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('customer_email')
        .eq('id', inq.customer_profile_id)
        .single()
      customerEmail = (profile as { customer_email: string | null } | null)?.customer_email ?? null
    }

    if (!customerEmail) {
      return { error: '顧客のメールアドレスが取得できません' }
    }

    const gmailUser = process.env.GMAIL_USER
    const gmailPass = process.env.GMAIL_APP_PASSWORD
    if (!gmailUser || !gmailPass) {
      return { error: 'GMAIL_USER / GMAIL_APP_PASSWORD が設定されていません' }
    }

    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    })

    const rawPayload = inq.raw_payload as Record<string, unknown> | null
    const originalMessageId = typeof rawPayload?.gmail_message_id === 'string'
      ? rawPayload.gmail_message_id
      : null

    const subjectLine = inq.subject
      ? (inq.subject.startsWith('Re:') ? inq.subject : `Re: ${inq.subject}`)
      : 'Re: お問い合わせについて'

    const customerNameLine = inq.customer_name ? `${inq.customer_name} 様\n\n` : ''
    const signature = 'Nextup株式会社\nカスタマー担当'
    const mailText = `${customerNameLine}${body}\n\n${signature}`
    const mailHtml = `${customerNameLine.replace(/\n/g, '<br>')}${body.replace(/\n/g, '<br>')}<br><br>${signature.replace(/\n/g, '<br>')}`

    try {
      await transporter.sendMail({
        from: `"Nextオンライン" <${gmailUser}>`,
        to: customerEmail,
        subject: subjectLine,
        text: mailText,
        html: mailHtml,
        ...(originalMessageId ? {
          inReplyTo: originalMessageId,
          references: originalMessageId,
        } : {}),
      })
    } catch (e) {
      return { error: `メール送信に失敗しました: ${e instanceof Error ? e.message : '不明なエラー'}` }
    }

    const { data: emailMsg } = await supabase.from('inquiry_messages').insert({
      inquiry_id: inquiryId,
      direction: 'outbound',
      sender_type: 'staff',
      sender_id: user.id,
      body,
      is_ai_draft: isAiDraft,
      ai_modified: isAiDraft && aiModified,
    }).select('id').single()
    savedMessageId = emailMsg?.id ?? null

    await supabase.from('activity_logs').insert({
      inquiry_id: inquiryId,
      actor_id: user.id,
      action: 'email_sent',
      before_val: null,
      after_val: { to: customerEmail, subject: subjectLine } as unknown as import('@/lib/types').Json,
    })
  } else {
    // その他チャネル（内部記録のみ）
    const { data: otherMsg } = await supabase.from('inquiry_messages').insert({
      inquiry_id: inquiryId,
      direction: 'outbound',
      sender_type: 'staff',
      sender_id: user.id,
      body,
      is_ai_draft: isAiDraft,
      ai_modified: isAiDraft && aiModified,
    }).select('id').single()
    savedMessageId = otherMsg?.id ?? null

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

  // support_actions 自動検知（失敗しても sendReply を止めない）
  if (savedMessageId) {
    try {
      const rawPayload = inq.raw_payload as Record<string, unknown> | null
      const customerQuestion = typeof rawPayload?.message === 'string' ? rawPayload.message : ''
      await detectAndSaveSupportAction({
        inquiryId,
        messageId: savedMessageId,
        replyBody: body,
        customerQuestion,
        itemName: inq.item_name ?? null,
        orderNumber: inq.order_number ?? null,
        customerName: inq.customer_name ?? null,
        mall: inq.source_channel ?? null,
        userId: user.id,
      })
    } catch (e) {
      console.error('[sendReply] support action detection failed:', e)
    }
  }

  return {}
}

async function detectAndSaveSupportAction(params: {
  inquiryId: string
  messageId: string
  replyBody: string
  customerQuestion: string
  itemName: string | null
  orderNumber: string | null
  customerName: string | null
  mall: string | null
  userId: string
}): Promise<void> {
  const { inquiryId, messageId, replyBody, customerQuestion, itemName, orderNumber, customerName, mall, userId } = params

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const userContent = [
    `【商品名】${itemName ?? '不明'}`,
    `【注文番号】${orderNumber ?? '不明'}`,
    `【顧客名】${customerName ?? '不明'}`,
    customerQuestion ? `【問い合わせ内容】\n${customerQuestion}` : '',
    `【送信した返信】\n${replyBody}`,
  ].filter(Boolean).join('\n\n')

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: `あなたはCS対応ログ解析AIです。送信した返信文を分析し、返金・交換・再送・補填が「確定」したかをJSON形式で返してください。

【確定表現の例（保存対象）】
・「返金いたします」「ご返金させていただきます」「返金処理を行います」
・「交換品を手配しました」「新しい商品をお送りします」
・「再送します」「改めてお送りします」
・「部品をお送りします」「パーツを送付します」
・「クーポンを発行します」「ポイントを付与します」

【提案表現（保存対象外）→ detected:false】
・「〜できます」「〜可能です」「〜はいかがでしょうか」「ご検討ください」

【出力形式】JSONのみ（説明・コードブロック不要）
detected=falseの場合: {"detected":false}
detected=trueの場合:
{
  "detected":true,
  "action_type":"refund"|"partial_refund"|"exchange"|"resend"|"parts_resend"|"coupon"|"other_compensation",
  "reason_category":"defective"|"damaged"|"missing_parts"|"wrong_item"|"wrong_quantity"|"size_mismatch"|"customer_reason"|"delivery_issue"|"specification_misunderstanding"|"other",
  "reason_detail":"理由の詳細（30字以内）",
  "refund_amount":数値またはnull,
  "replacement_quantity":数値またはnull,
  "estimated_loss_amount":数値またはnull,
  "sku":文字列またはnull,
  "product_id":文字列またはnull,
  "quantity":数値またはnull,
  "confidence":0から1の数値
}`,
    messages: [{ role: 'user', content: userContent }],
  })

  const raw = resp.content[0]?.type === 'text' ? resp.content[0].text.trim() : ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any
  try {
    result = JSON.parse(raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, ''))
  } catch {
    return
  }

  if (!result?.detected) return

  const confidence = typeof result.confidence === 'number' ? result.confidence : 0
  const status = confidence < 0.75 ? 'needs_review' : 'auto_saved'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kb = createKnowledgeClient() as any
  const { error: insertErr } = await kb.from('support_actions').insert({
    inquiry_id: inquiryId,
    message_id: messageId,
    mall,
    order_number: orderNumber,
    customer_name: customerName,
    product_name: itemName,
    sku: result.sku ?? null,
    product_id: result.product_id ?? null,
    quantity: result.quantity ?? null,
    action_type: result.action_type,
    reason_category: result.reason_category ?? null,
    reason_detail: result.reason_detail ?? null,
    refund_amount: result.refund_amount ?? null,
    replacement_quantity: result.replacement_quantity ?? null,
    estimated_loss_amount: result.estimated_loss_amount ?? null,
    staff_id: userId,
    detection_source: 'ai',
    ai_confidence: confidence,
    status,
  })
  // 重複（unique constraint違反）は無視
  if (insertErr && !insertErr.message?.includes('duplicate') && !insertErr.code?.startsWith('23')) {
    console.error('[detectAndSaveSupportAction] insert error:', insertErr)
  }
}

export async function deleteSupportAction(supportActionId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラー' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('support_actions')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', supportActionId)
    .eq('staff_id', user.id)

  if (error) return { error: error.message }
  return {}
}

export async function confirmSupportAction(supportActionId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラー' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('support_actions')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', supportActionId)

  if (error) return { error: error.message }
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

  // 2. knowledge_cases / knowledge_templates / product_knowledge をキーワード検索
  type KnowledgeCase     = { product_name: string | null; question: string | null; reply_body: string | null }
  type KnowledgeTemplate = { phrase: string | null; body: string | null }
  type ProductKnowledge  = { features: string | null; notes: string | null; campaign_name: string | null; present_summary: string | null; ai_notes: string | null; synonyms: string[] | null }
  let matchedCase:     KnowledgeCase     | null = null
  let matchedTemplate: KnowledgeTemplate | null = null
  let matchedProductKnowledge: ProductKnowledge | null = null
  let matchedReturnShippingFee: number | null = null

  const kb = createKnowledgeClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kba = kb as any

  // product_knowledge lookup: SKU → product_name → synonyms
  try {
    const pkSelect = 'features, notes, campaign_name, present_summary, ai_notes, synonyms'
    const itemName = inq.subject ?? ''
    // 1. SKU一致
    const skuMatch = await kba.from('products')
      .select(`id, sku, return_shipping_fee, product_knowledge(${pkSelect})`)
      .eq('is_active', true)
      .eq('sku', itemName.trim())
      .limit(1)
      .maybeSingle()
    if (skuMatch.data?.product_knowledge?.[0]) {
      matchedProductKnowledge = skuMatch.data.product_knowledge[0]
      matchedReturnShippingFee = skuMatch.data.return_shipping_fee ?? null
    }

    if (!matchedProductKnowledge && itemName) {
      // 2. product_name 部分一致
      const nameMatch = await kba.from('products')
        .select(`id, return_shipping_fee, product_knowledge(${pkSelect})`)
        .eq('is_active', true)
        .ilike('product_name', `%${itemName}%`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (nameMatch.data?.product_knowledge?.[0]) {
        matchedProductKnowledge = nameMatch.data.product_knowledge[0]
        matchedReturnShippingFee = nameMatch.data.return_shipping_fee ?? null
      }
    }

    if (!matchedProductKnowledge && mainKeyword) {
      // 3. synonyms 配列にキーワード含む
      const { data: pkRows } = await kba.from('product_knowledge')
        .select(`${pkSelect}, product_id`)
        .eq('is_active', true)
        .contains('synonyms', [mainKeyword])
        .order('priority', { ascending: false })
        .limit(1)
      if (pkRows?.[0]) {
        matchedProductKnowledge = pkRows[0]
        const { data: prodRow } = await kba.from('products')
          .select('return_shipping_fee')
          .eq('id', pkRows[0].product_id)
          .maybeSingle()
        matchedReturnShippingFee = prodRow?.return_shipping_fee ?? null
      }
    }
  } catch (e) {
    console.error('[generateAiDraft] product_knowledge search error:', e)
  }

  if (mainKeyword) {
    try {
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
  // product_knowledge コンテキストを付記（draft末尾ではなくメモとして渡す）
  const pkContext: string[] = []
  if (matchedProductKnowledge) {
    if (matchedProductKnowledge.features) pkContext.push(`商品特徴: ${matchedProductKnowledge.features}`)
    if (matchedProductKnowledge.present_summary) pkContext.push(`プレゼント: ${matchedProductKnowledge.present_summary}`)
    if (matchedProductKnowledge.campaign_name) pkContext.push(`キャンペーン: ${matchedProductKnowledge.campaign_name}`)
    if (matchedProductKnowledge.notes) pkContext.push(`CS備考: ${matchedProductKnowledge.notes}`)
  }
  if (matchedReturnShippingFee != null) {
    pkContext.push(`お客様都合の再送料: ¥${matchedReturnShippingFee.toLocaleString()}`)
  }

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
        product_knowledge_used: matchedProductKnowledge != null,
        pk_context: pkContext.length > 0 ? pkContext : null,
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

export type TemplateItem = {
  id: number
  category: string
  phrase: string
  body: string
  use_count: number
}

export async function fetchTemplates(): Promise<TemplateItem[]> {
  const kb = createKnowledgeClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await kb
    .from('knowledge_templates')
    .select('id, category, phrase, body, use_count')
    .order('use_count', { ascending: false })
    .order('category', { ascending: true })
  return (data ?? []) as TemplateItem[]
}

export async function recordTemplateUse(id: number): Promise<void> {
  const kb = createKnowledgeClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  await kb.rpc('increment_template_use_count', { template_id: id })
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

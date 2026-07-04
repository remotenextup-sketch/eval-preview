'use server'

import { createClient } from '@/lib/supabase/server'
import { callBossExchange, callBossCancel } from '@/lib/boss-api'
import { revalidatePath } from 'next/cache'

type ExchangeParams = {
  inquiryId: string
  orderNumber: string
  mall: string
  itemName: string
  sku: string | null
  quantity: number
  reason: string
  memo: string
  aiSuggested: boolean
  aiReason: string | null
  aiConfidence: number | null
}

type CancelParams = {
  inquiryId: string
  orderNumber: string
  mall: string
  itemName: string
  reason: string
  refundAmount: number | null
  memo: string
  aiSuggested: boolean
  aiReason: string | null
  aiConfidence: number | null
}

export async function executeBossExchange(params: ExchangeParams): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // 二重実行防止チェック
  const { data: existing } = await db
    .from('boss_actions')
    .select('id, created_at')
    .eq('order_number', params.orderNumber)
    .eq('action_type', 'exchange')
    .eq('status', 'success')
    .limit(1)
  if (existing && existing.length > 0) {
    return { error: 'この注文番号ですでに交換処理が実行済みです' }
  }

  const requestPayload = {
    order_number: params.orderNumber,
    mall: params.mall,
    item_name: params.itemName,
    sku: params.sku,
    quantity: params.quantity,
    reason: params.reason,
    memo: params.memo || null,
  }

  // pending レコード作成
  const { data: bossAction, error: insertErr } = await db
    .from('boss_actions')
    .insert({
      inquiry_id: params.inquiryId,
      order_number: params.orderNumber,
      mall: params.mall,
      action_type: 'exchange',
      status: 'pending',
      ai_suggested: params.aiSuggested,
      ai_reason: params.aiReason,
      ai_confidence: params.aiConfidence,
      request_payload: requestPayload,
      executed_by: user.id,
      executed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertErr) return { error: insertErr.message }

  // BOSS API 呼び出し
  let apiResult
  try {
    apiResult = await callBossExchange(requestPayload)
  } catch (e) {
    await db.from('boss_actions').update({
      status: 'failed',
      error_message: e instanceof Error ? e.message : '不明なエラー',
    }).eq('id', bossAction.id)
    return { error: `BOSS API エラー: ${e instanceof Error ? e.message : '不明なエラー'}` }
  }

  if (!apiResult.success) {
    await db.from('boss_actions').update({
      status: 'failed',
      response_payload: apiResult.raw,
      error_message: apiResult.message,
    }).eq('id', bossAction.id)
    return { error: apiResult.message }
  }

  // 成功
  await db.from('boss_actions').update({
    status: 'success',
    response_payload: apiResult.raw,
  }).eq('id', bossAction.id)

  // support_actions にも記録
  try {
    await db.from('support_actions').insert({
      inquiry_id: params.inquiryId,
      mall: params.mall,
      order_number: params.orderNumber,
      product_name: params.itemName,
      sku: params.sku,
      quantity: params.quantity,
      action_type: 'exchange',
      reason_detail: params.reason,
      detection_source: 'manual',
      status: 'confirmed',
      staff_id: user.id,
    })
  } catch {
    // support_actions 失敗は無視（boss_actions は成功済み）
  }

  revalidatePath(`/inbox/${params.inquiryId}`)
  return {}
}

export async function executeBossCancel(params: CancelParams): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // 二重実行防止チェック
  const { data: existing } = await db
    .from('boss_actions')
    .select('id')
    .eq('order_number', params.orderNumber)
    .eq('action_type', 'cancel')
    .eq('status', 'success')
    .limit(1)
  if (existing && existing.length > 0) {
    return { error: 'この注文番号ですでにキャンセル処理が実行済みです' }
  }

  const requestPayload = {
    order_number: params.orderNumber,
    mall: params.mall,
    item_name: params.itemName,
    reason: params.reason,
    refund_amount: params.refundAmount,
    memo: params.memo || null,
  }

  const { data: bossAction, error: insertErr } = await db
    .from('boss_actions')
    .insert({
      inquiry_id: params.inquiryId,
      order_number: params.orderNumber,
      mall: params.mall,
      action_type: 'cancel',
      status: 'pending',
      ai_suggested: params.aiSuggested,
      ai_reason: params.aiReason,
      ai_confidence: params.aiConfidence,
      request_payload: requestPayload,
      executed_by: user.id,
      executed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertErr) return { error: insertErr.message }

  let apiResult
  try {
    apiResult = await callBossCancel(requestPayload)
  } catch (e) {
    await db.from('boss_actions').update({
      status: 'failed',
      error_message: e instanceof Error ? e.message : '不明なエラー',
    }).eq('id', bossAction.id)
    return { error: `BOSS API エラー: ${e instanceof Error ? e.message : '不明なエラー'}` }
  }

  if (!apiResult.success) {
    await db.from('boss_actions').update({
      status: 'failed',
      response_payload: apiResult.raw,
      error_message: apiResult.message,
    }).eq('id', bossAction.id)
    return { error: apiResult.message }
  }

  await db.from('boss_actions').update({
    status: 'success',
    response_payload: apiResult.raw,
  }).eq('id', bossAction.id)

  // support_actions にも記録
  try {
    const actionType = params.refundAmount ? 'refund' : 'other_compensation'
    await db.from('support_actions').insert({
      inquiry_id: params.inquiryId,
      mall: params.mall,
      order_number: params.orderNumber,
      product_name: params.itemName,
      action_type: actionType,
      reason_detail: params.reason,
      refund_amount: params.refundAmount,
      detection_source: 'manual',
      status: 'confirmed',
      staff_id: user.id,
    })
  } catch {
    // support_actions 失敗は無視
  }

  revalidatePath(`/inbox/${params.inquiryId}`)
  return {}
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ACTION_TYPE_LABELS: Record<string, string> = {
  refund: '返金', partial_refund: '一部返金', exchange: '交換',
  resend: '再送', parts_resend: '部品送付', coupon: 'クーポン/ポイント', other_compensation: 'その他補填',
}
const REASON_LABELS: Record<string, string> = {
  defective: '初期不良', damaged: '破損', missing_parts: '部品欠品', wrong_item: '誤品',
  wrong_quantity: '数量誤り', size_mismatch: 'サイズ不一致', customer_reason: 'お客様都合',
  delivery_issue: '配送問題', specification_misunderstanding: '仕様誤認', other: 'その他',
}
const STATUS_LABELS: Record<string, string> = {
  auto_saved: '自動保存', needs_review: '要確認', confirmed: '確認済み', deleted: '削除済み',
}

function esc(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const p = url.searchParams

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('support_actions')
    .select('id, mall, order_number, customer_name, product_name, sku, quantity, action_type, reason_category, reason_detail, refund_amount, replacement_quantity, estimated_loss_amount, ai_confidence, status, created_at, staff:staff_id(display_name)')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(10000)

  if (p.get('from')) query = query.gte('created_at', `${p.get('from')}T00:00:00+09:00`)
  if (p.get('to'))   query = query.lte('created_at', `${p.get('to')}T23:59:59+09:00`)
  if (p.get('mall')) query = query.eq('mall', p.get('mall'))
  if (p.get('action_type')) query = query.eq('action_type', p.get('action_type'))
  if (p.get('reason_category')) query = query.eq('reason_category', p.get('reason_category'))
  if (p.get('status')) query = query.eq('status', p.get('status'))
  if (p.get('q')) {
    const like = `%${p.get('q')}%`
    query = query.or(`product_name.ilike.${like},sku.ilike.${like},order_number.ilike.${like},customer_name.ilike.${like}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = ['発生日', 'モール', '注文番号', '顧客名', '商品名', 'SKU', '個数', '対応種別', '理由カテゴリ', '理由詳細', '返金額', '交換数', '推定損失額', '対応者', 'ステータス']
  const rows = (data ?? []).map((r: Record<string, unknown>) => [
    new Date(r.created_at as string).toLocaleDateString('ja-JP'),
    r.mall,
    r.order_number,
    r.customer_name,
    r.product_name,
    r.sku,
    r.quantity,
    ACTION_TYPE_LABELS[(r.action_type as string)] ?? r.action_type,
    REASON_LABELS[(r.reason_category as string) ?? ''] ?? r.reason_category,
    r.reason_detail,
    r.refund_amount,
    r.replacement_quantity,
    r.estimated_loss_amount,
    (r.staff as { display_name: string } | null)?.display_name,
    STATUS_LABELS[(r.status as string)] ?? r.status,
  ].map(esc).join(','))

  const csv = '﻿' + [headers.join(','), ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="support-actions.csv"`,
    },
  })
}

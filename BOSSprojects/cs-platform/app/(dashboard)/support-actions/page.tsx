import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ExportCsvButton } from './ExportCsvButton'

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

type SupportActionRow = {
  id: string
  inquiry_id: string
  mall: string | null
  order_number: string | null
  customer_name: string | null
  product_name: string | null
  sku: string | null
  quantity: number | null
  action_type: string
  reason_category: string | null
  reason_detail: string | null
  refund_amount: number | null
  replacement_quantity: number | null
  estimated_loss_amount: number | null
  staff: { display_name: string } | null
  ai_confidence: number | null
  status: string
  created_at: string
}

type SearchParams = {
  from?: string
  to?: string
  mall?: string
  action_type?: string
  reason_category?: string
  status?: string
  q?: string
}

function sumBy<T>(arr: T[], fn: (item: T) => number | null): number {
  return arr.reduce((s, i) => s + (fn(i) ?? 0), 0)
}

function groupCount<T>(arr: T[], key: (item: T) => string | null): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of arr) {
    const k = key(item) ?? 'unknown'
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

function groupSum<T>(arr: T[], key: (item: T) => string | null, val: (item: T) => number | null): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of arr) {
    const k = key(item) ?? 'unknown'
    out[k] = (out[k] ?? 0) + (val(item) ?? 0)
  }
  return out
}

export default async function SupportActionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('support_actions')
    .select('id, inquiry_id, mall, order_number, customer_name, product_name, sku, quantity, action_type, reason_category, reason_detail, refund_amount, replacement_quantity, estimated_loss_amount, ai_confidence, status, created_at, staff:staff_id(display_name)')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(500)

  if (params.from) query = query.gte('created_at', `${params.from}T00:00:00+09:00`)
  if (params.to)   query = query.lte('created_at', `${params.to}T23:59:59+09:00`)
  if (params.mall) query = query.eq('mall', params.mall)
  if (params.action_type) query = query.eq('action_type', params.action_type)
  if (params.reason_category) query = query.eq('reason_category', params.reason_category)
  if (params.status) query = query.eq('status', params.status)
  if (params.q) {
    const like = `%${params.q}%`
    query = query.or(`product_name.ilike.${like},sku.ilike.${like},order_number.ilike.${like},customer_name.ilike.${like}`)
  }

  const { data } = await query
  const rows: SupportActionRow[] = data ?? []

  // 集計
  const totalRefund    = sumBy(rows, r => r.refund_amount)
  const totalLoss      = sumBy(rows, r => r.estimated_loss_amount)
  const byActionType   = groupCount(rows, r => r.action_type)
  const byReason       = groupCount(rows, r => r.reason_category)
  const byMall         = groupCount(rows, r => r.mall)
  const byStaff        = groupCount(rows, r => (r.staff as { display_name: string } | null)?.display_name ?? null)
  const refundByProduct = groupSum(rows, r => r.product_name, r => r.refund_amount)
  const countByProduct  = groupCount(rows, r => r.product_name)

  // 月別集計
  const byMonth: Record<string, { refund: number; loss: number; count: number }> = {}
  for (const r of rows) {
    const m = r.created_at.slice(0, 7) // YYYY-MM
    if (!byMonth[m]) byMonth[m] = { refund: 0, loss: 0, count: 0 }
    byMonth[m].refund += r.refund_amount ?? 0
    byMonth[m].loss   += r.estimated_loss_amount ?? 0
    byMonth[m].count  += 1
  }

  const filterUrl = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { from: params.from, to: params.to, mall: params.mall, action_type: params.action_type, reason_category: params.reason_category, status: params.status, q: params.q, ...overrides }
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v)
    const s = p.toString()
    return `/support-actions${s ? `?${s}` : ''}`
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-base font-semibold text-gray-900">対応履歴（返金・交換・再送）</h1>
        <ExportCsvButton searchParams={params} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* フィルタ */}
        <form method="GET" className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="text-xs text-gray-500">開始日</label>
            <input type="date" name="from" defaultValue={params.from} className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="text-xs text-gray-500">終了日</label>
            <input type="date" name="to" defaultValue={params.to} className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">対応種別</label>
            <select name="action_type" defaultValue={params.action_type ?? ''} className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">すべて</option>
              {Object.entries(ACTION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">理由</label>
            <select name="reason_category" defaultValue={params.reason_category ?? ''} className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">すべて</option>
              {Object.entries(REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">ステータス</label>
            <select name="status" defaultValue={params.status ?? ''} className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">すべて</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500">商品名/SKU/注文番号/顧客名</label>
            <input type="text" name="q" defaultValue={params.q} placeholder="検索..." className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <button type="submit" className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded">絞り込み</button>
          <Link href="/support-actions" className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5">クリア</Link>
        </form>

        {/* サマリカード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">総件数</p>
            <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
          </div>
          <div className="bg-white border border-red-200 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">総返金額</p>
            <p className="text-2xl font-bold text-red-600">¥{totalRefund.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-orange-200 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">推定総損失額</p>
            <p className="text-2xl font-bold text-orange-600">¥{totalLoss.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-orange-100 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">要確認件数</p>
            <p className="text-2xl font-bold text-orange-500">{rows.filter(r => r.status === 'needs_review').length}</p>
          </div>
        </div>

        {/* 集計グリッド */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 月別 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">月別件数・返金額</p>
            <div className="space-y-1">
              {Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6).map(([m, v]) => (
                <div key={m} className="flex justify-between text-xs">
                  <span className="text-gray-600">{m}</span>
                  <span className="text-gray-800">{v.count}件 / ¥{v.refund.toLocaleString()}</span>
                </div>
              ))}
              {Object.keys(byMonth).length === 0 && <p className="text-xs text-gray-400">データなし</p>}
            </div>
          </div>

          {/* 対応種別 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">対応種別</p>
            <div className="space-y-1">
              {Object.entries(byActionType).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-600">{ACTION_TYPE_LABELS[k] ?? k}</span>
                  <span className="font-medium">{n}件</span>
                </div>
              ))}
              {Object.keys(byActionType).length === 0 && <p className="text-xs text-gray-400">データなし</p>}
            </div>
          </div>

          {/* 理由カテゴリ */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">理由カテゴリ</p>
            <div className="space-y-1">
              {Object.entries(byReason).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-600">{REASON_LABELS[k] ?? k}</span>
                  <span className="font-medium">{n}件</span>
                </div>
              ))}
              {Object.keys(byReason).length === 0 && <p className="text-xs text-gray-400">データなし</p>}
            </div>
          </div>

          {/* モール別 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">モール別</p>
            <div className="space-y-1">
              {Object.entries(byMall).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-600">{k}</span>
                  <span className="font-medium">{n}件</span>
                </div>
              ))}
              {Object.keys(byMall).length === 0 && <p className="text-xs text-gray-400">データなし</p>}
            </div>
          </div>

          {/* 商品別件数・返金額 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">商品別（上位5件）</p>
            <div className="space-y-1">
              {Object.entries(countByProduct).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-600 truncate max-w-[150px]">{k === 'unknown' ? '不明' : k}</span>
                  <span className="font-medium">{n}件 / ¥{(refundByProduct[k] ?? 0).toLocaleString()}</span>
                </div>
              ))}
              {Object.keys(countByProduct).length === 0 && <p className="text-xs text-gray-400">データなし</p>}
            </div>
          </div>

          {/* 担当者別 */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">担当者別</p>
            <div className="space-y-1">
              {Object.entries(byStaff).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-600">{k === 'unknown' ? '不明' : k}</span>
                  <span className="font-medium">{n}件</span>
                </div>
              ))}
              {Object.keys(byStaff).length === 0 && <p className="text-xs text-gray-400">データなし</p>}
            </div>
          </div>
        </div>

        {/* テーブル */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">{rows.length} 件{rows.length >= 500 ? '（上限500件）' : ''}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['発生日', 'モール', '注文番号', '顧客名', '商品名', 'SKU', '個数', '対応種別', '理由', '理由詳細', '返金額', '交換数', '推定損失', '担当者', 'ステータス'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${r.status === 'needs_review' ? 'bg-orange-50' : ''}`}>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                      {new Date(r.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.mall ?? '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono">
                      {r.inquiry_id
                        ? <Link href={`/inbox/${r.inquiry_id}`} className="text-blue-600 hover:underline">{r.order_number ?? '-'}</Link>
                        : (r.order_number ?? '-')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.customer_name ?? '-'}</td>
                    <td className="px-3 py-2 max-w-[150px] truncate" title={r.product_name ?? undefined}>{r.product_name ?? '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono">{r.sku ?? '-'}</td>
                    <td className="px-3 py-2 text-center">{r.quantity ?? '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded font-medium ${
                        r.action_type === 'refund' || r.action_type === 'partial_refund' ? 'bg-red-100 text-red-700'
                        : r.action_type === 'exchange' || r.action_type === 'resend' || r.action_type === 'parts_resend' ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                      }`}>
                        {ACTION_TYPE_LABELS[r.action_type] ?? r.action_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{REASON_LABELS[r.reason_category ?? ''] ?? (r.reason_category ?? '-')}</td>
                    <td className="px-3 py-2 max-w-[150px] truncate" title={r.reason_detail ?? undefined}>{r.reason_detail ?? '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-red-600">
                      {r.refund_amount != null ? `¥${r.refund_amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">{r.replacement_quantity ?? '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-orange-600">
                      {r.estimated_loss_amount != null ? `¥${r.estimated_loss_amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{(r.staff as { display_name: string } | null)?.display_name ?? '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        r.status === 'needs_review' ? 'bg-orange-200 text-orange-800 font-semibold'
                        : r.status === 'confirmed' ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={15} className="px-3 py-8 text-center text-gray-400">対応履歴がありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

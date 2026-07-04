'use client'

import { useState, useTransition } from 'react'
import { executeBossExchange, executeBossCancel } from './boss-actions'
import type { ShippingOrderData } from './ShippingStatusSection'

export type BossAction = {
  id: string
  action_type: string
  status: string
  ai_suggested: boolean
  ai_reason: string | null
  error_message: string | null
  executed_at: string | null
  created_at: string
}

type Props = {
  inquiryId: string
  orderNumber: string | null
  mall: string | null
  order: ShippingOrderData | null
  bossActions: BossAction[]
  suggestExchange: boolean
  suggestCancel: boolean
  suggestReason: string | null
}

const EXCHANGE_REASONS = ['初期不良', '破損', '誤品', '数量不足', 'その他']
const CANCEL_REASONS = ['顧客都合', '商品不良', '配送問題', '在庫切れ', 'その他']

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: '処理中', className: 'text-yellow-600 bg-yellow-50' },
  success: { label: '完了', className: 'text-green-700 bg-green-50' },
  failed: { label: '失敗', className: 'text-red-600 bg-red-50' },
}

const ACTION_LABEL: Record<string, string> = {
  exchange: '交換',
  cancel: 'キャンセル',
}

export function BossActionsSection({
  inquiryId,
  orderNumber,
  mall,
  order,
  bossActions,
  suggestExchange,
  suggestCancel,
  suggestReason,
}: Props) {
  const [modal, setModal] = useState<'exchange' | 'cancel' | null>(null)

  // Exchange form state
  const [exReason, setExReason] = useState(EXCHANGE_REASONS[0])
  const [exReasonDetail, setExReasonDetail] = useState('')
  const [exMemo, setExMemo] = useState('')
  const [exItemIdx, setExItemIdx] = useState(0)
  const [exQty, setExQty] = useState(1)

  // Cancel form state
  const [caReason, setCaReason] = useState(CANCEL_REASONS[0])
  const [caReasonDetail, setCaReasonDetail] = useState('')
  const [caMemo, setCaMemo] = useState('')
  const [caItemIdx, setCaItemIdx] = useState(0)

  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const items = order?.items ?? []
  const selectedExItem = items[exItemIdx]
  const selectedCaItem = items[caItemIdx]

  const hasExchangeDone = bossActions.some(a => a.action_type === 'exchange' && a.status === 'success')
  const hasCancelDone = bossActions.some(a => a.action_type === 'cancel' && a.status === 'success')

  function openModal(type: 'exchange' | 'cancel') {
    setModal(type)
    setResult(null)
    setExItemIdx(0)
    setExQty(selectedExItem?.quantity ?? 1)
    setCaItemIdx(0)
  }

  function closeModal() {
    setModal(null)
    setResult(null)
  }

  function handleExchange() {
    if (!orderNumber) return
    const itemName = selectedExItem?.item_name ?? '不明'
    const sku = null
    const reason = exReasonDetail.trim() ? `${exReason}：${exReasonDetail.trim()}` : exReason
    startTransition(async () => {
      const res = await executeBossExchange({
        inquiryId,
        orderNumber,
        mall: mall ?? '',
        itemName,
        sku,
        quantity: exQty,
        reason,
        memo: exMemo,
        aiSuggested: suggestExchange,
        aiReason: suggestReason,
        aiConfidence: null,
      })
      if (res.error) {
        setResult({ ok: false, message: res.error })
      } else {
        setResult({ ok: true, message: '交換処理を実行しました' })
      }
    })
  }

  function handleCancel() {
    if (!orderNumber) return
    const itemName = selectedCaItem?.item_name ?? '不明'
    const reason = caReasonDetail.trim() ? `${caReason}：${caReasonDetail.trim()}` : caReason
    startTransition(async () => {
      const res = await executeBossCancel({
        inquiryId,
        orderNumber,
        mall: mall ?? '',
        itemName,
        reason,
        refundAmount: order?.total_amount ?? null,
        memo: caMemo,
        aiSuggested: suggestCancel,
        aiReason: suggestReason,
        aiConfidence: null,
      })
      if (res.error) {
        setResult({ ok: false, message: res.error })
      } else {
        setResult({ ok: true, message: 'キャンセル処理を実行しました' })
      }
    })
  }

  return (
    <>
      <div className="space-y-3">
        {/* AI提案バナー */}
        {(suggestExchange || suggestCancel) && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-2.5 space-y-1">
            <p className="text-xs font-medium text-blue-700">AI候補</p>
            {suggestExchange && (
              <p className="text-xs text-blue-600">・交換処理候補があります</p>
            )}
            {suggestCancel && (
              <p className="text-xs text-blue-600">・キャンセル/返金処理候補があります</p>
            )}
            {suggestReason && (
              <p className="text-xs text-blue-500 mt-1">理由: {suggestReason}</p>
            )}
          </div>
        )}

        {/* 注文情報 */}
        {orderNumber ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">注文番号</span>
              <span className="text-xs font-mono text-gray-800 truncate max-w-[140px]">{orderNumber}</span>
            </div>
            {mall && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">モール</span>
                <span className="text-xs text-gray-700">{mall}</span>
              </div>
            )}
            {order?.shipment_status && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">ステータス</span>
                <span className="text-xs text-gray-700">{order.shipment_status}</span>
              </div>
            )}
            {items.length > 0 && (
              <div className="mt-2 space-y-1">
                {items.slice(0, 3).map((item, i) => (
                  <div key={i} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                    {item.item_name ?? '商品名不明'} × {item.quantity}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400">注文番号が見つかりません</p>
        )}

        {/* 実行ボタン */}
        {orderNumber && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => openModal('exchange')}
              disabled={hasExchangeDone}
              title={hasExchangeDone ? '交換処理実行済み' : undefined}
              className="flex-1 text-xs font-medium px-2 py-1.5 rounded-md border transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
                border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100"
            >
              {hasExchangeDone ? '交換済み' : '交換処理'}
            </button>
            <button
              onClick={() => openModal('cancel')}
              disabled={hasCancelDone}
              title={hasCancelDone ? 'キャンセル処理実行済み' : undefined}
              className="flex-1 text-xs font-medium px-2 py-1.5 rounded-md border transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
                border-red-300 text-red-700 bg-red-50 hover:bg-red-100"
            >
              {hasCancelDone ? 'キャンセル済み' : 'キャンセル処理'}
            </button>
          </div>
        )}

        {/* 実行履歴 */}
        {bossActions.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">実行履歴</p>
            {bossActions.map(a => {
              const st = STATUS_LABEL[a.status] ?? { label: a.status, className: 'text-gray-500 bg-gray-50' }
              return (
                <div key={a.id} className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${st.className}`}>{st.label}</span>
                    <span className="text-xs text-gray-600">{ACTION_LABEL[a.action_type] ?? a.action_type}</span>
                    {a.ai_suggested && <span className="text-xs text-blue-400">AI</span>}
                  </div>
                  <span className="text-xs text-gray-400">
                    {a.executed_at
                      ? new Date(a.executed_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 交換モーダル */}
      {modal === 'exchange' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">交換処理の確認</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* 注文情報 */}
              <div className="bg-gray-50 rounded-md p-3 space-y-1.5">
                <Row label="注文番号" value={orderNumber ?? '—'} />
                <Row label="モール" value={mall ?? '—'} />
                <Row label="送付先" value="注文に登録された住所に発送" />
              </div>

              {/* 商品選択 */}
              {items.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">交換対象商品</label>
                  <select
                    value={exItemIdx}
                    onChange={e => setExItemIdx(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {items.map((item, i) => (
                      <option key={i} value={i}>{item.item_name ?? `商品${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              )}
              {items.length === 1 && (
                <div className="bg-gray-50 rounded-md p-3">
                  <Row label="商品" value={selectedExItem?.item_name ?? '不明'} />
                </div>
              )}

              {/* 数量 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">数量</label>
                <input
                  type="number"
                  min={1}
                  value={exQty}
                  onChange={e => setExQty(Math.max(1, Number(e.target.value)))}
                  className="w-24 border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 交換理由 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">交換理由</label>
                <select
                  value={exReason}
                  onChange={e => setExReason(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {EXCHANGE_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
                <input
                  type="text"
                  value={exReasonDetail}
                  onChange={e => setExReasonDetail(e.target.value)}
                  placeholder="詳細（任意）"
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* メモ */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                <textarea
                  value={exMemo}
                  onChange={e => setExMemo(e.target.value)}
                  rows={2}
                  placeholder="備考・連絡事項"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {result && (
                <p className={`text-xs ${result.ok ? 'text-green-600' : 'text-red-600'}`}>{result.message}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200">
              <button onClick={closeModal} className="px-4 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50">
                キャンセル
              </button>
              <button
                onClick={handleExchange}
                disabled={isPending || result?.ok === true}
                className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? '処理中...' : '交換処理を実行'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* キャンセルモーダル */}
      {modal === 'cancel' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">キャンセル処理の確認</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* 注文情報 */}
              <div className="bg-gray-50 rounded-md p-3 space-y-1.5">
                <Row label="注文番号" value={orderNumber ?? '—'} />
                <Row label="モール" value={mall ?? '—'} />
                {order?.total_amount != null && (
                  <Row label="返金予定額" value={`¥${order.total_amount.toLocaleString()}`} />
                )}
              </div>

              {/* 商品選択 */}
              {items.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">対象商品</label>
                  <select
                    value={caItemIdx}
                    onChange={e => setCaItemIdx(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {items.map((item, i) => (
                      <option key={i} value={i}>{item.item_name ?? `商品${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              )}
              {items.length === 1 && (
                <div className="bg-gray-50 rounded-md p-3">
                  <Row label="商品" value={selectedCaItem?.item_name ?? '不明'} />
                </div>
              )}

              {/* キャンセル理由 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">キャンセル理由</label>
                <select
                  value={caReason}
                  onChange={e => setCaReason(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CANCEL_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
                <input
                  type="text"
                  value={caReasonDetail}
                  onChange={e => setCaReasonDetail(e.target.value)}
                  placeholder="詳細（任意）"
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* メモ */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                <textarea
                  value={caMemo}
                  onChange={e => setCaMemo(e.target.value)}
                  rows={2}
                  placeholder="備考・連絡事項"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {result && (
                <p className={`text-xs ${result.ok ? 'text-green-600' : 'text-red-600'}`}>{result.message}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200">
              <button onClick={closeModal} className="px-4 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50">
                閉じる
              </button>
              <button
                onClick={handleCancel}
                disabled={isPending || result?.ok === true}
                className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? '処理中...' : 'キャンセル処理を実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-800 text-right">{value}</span>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteSupportAction, confirmSupportAction } from './actions'

export type SupportAction = {
  id: string
  action_type: string
  reason_category: string | null
  reason_detail: string | null
  refund_amount: number | null
  replacement_quantity: number | null
  estimated_loss_amount: number | null
  ai_confidence: number | null
  status: string
  created_at: string
  product_name: string | null
  sku: string | null
  quantity: number | null
  detection_source: string | null
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  refund: '返金',
  partial_refund: '一部返金',
  exchange: '交換',
  resend: '再送',
  parts_resend: '部品送付',
  coupon: 'クーポン/ポイント',
  other_compensation: 'その他補填',
}

const REASON_LABELS: Record<string, string> = {
  defective: '初期不良',
  damaged: '破損',
  missing_parts: '部品欠品',
  wrong_item: '誤品',
  wrong_quantity: '数量誤り',
  size_mismatch: 'サイズ不一致',
  customer_reason: 'お客様都合',
  delivery_issue: '配送問題',
  specification_misunderstanding: '仕様誤認',
  other: 'その他',
}

function ActionCard({ action }: { action: SupportAction }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isNeedsReview = action.status === 'needs_review'
  const isDeleted = action.status === 'deleted'

  function handleDelete() {
    startTransition(async () => {
      await deleteSupportAction(action.id)
      router.refresh()
    })
  }

  function handleConfirm() {
    startTransition(async () => {
      await confirmSupportAction(action.id)
      router.refresh()
    })
  }

  if (isDeleted) return null

  return (
    <div className={`rounded-md border px-3 py-2 text-xs space-y-1 ${
      isNeedsReview ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-1.5 py-0.5 rounded font-semibold ${
            action.action_type === 'refund' || action.action_type === 'partial_refund'
              ? 'bg-red-100 text-red-700'
              : action.action_type === 'exchange' || action.action_type === 'resend' || action.action_type === 'parts_resend'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-purple-100 text-purple-700'
          }`}>
            {ACTION_TYPE_LABELS[action.action_type] ?? action.action_type}
          </span>
          {isNeedsReview && (
            <span className="px-1.5 py-0.5 rounded bg-orange-200 text-orange-800 font-semibold">要確認</span>
          )}
          {action.status === 'confirmed' && (
            <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">確認済み</span>
          )}
        </div>
        <span className="text-gray-400">
          {new Date(action.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {action.reason_category && (
        <p className="text-gray-600">
          理由: {REASON_LABELS[action.reason_category] ?? action.reason_category}
          {action.reason_detail ? `（${action.reason_detail}）` : ''}
        </p>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-gray-500">
        {action.refund_amount != null && (
          <span>返金額: <span className="font-medium text-red-600">¥{action.refund_amount.toLocaleString()}</span></span>
        )}
        {action.replacement_quantity != null && (
          <span>交換数: {action.replacement_quantity}</span>
        )}
        {action.estimated_loss_amount != null && (
          <span>推定損失: ¥{action.estimated_loss_amount.toLocaleString()}</span>
        )}
        {action.sku && <span>SKU: {action.sku}</span>}
      </div>

      {action.ai_confidence != null && (
        <p className="text-gray-400">信頼度: {Math.round(action.ai_confidence * 100)}%</p>
      )}

      {(isNeedsReview || action.status === 'auto_saved') && (
        <div className="flex gap-2 pt-1">
          {isNeedsReview && (
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="text-xs text-green-600 hover:text-green-800 underline disabled:opacity-50"
            >
              確認済みにする
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs text-red-400 hover:text-red-600 underline disabled:opacity-50"
          >
            誤検知・削除
          </button>
        </div>
      )}
    </div>
  )
}

export function SupportActionsSection({ actions }: { actions: SupportAction[] }) {
  const visible = actions.filter(a => a.status !== 'deleted')

  if (visible.length === 0) {
    return <p className="text-xs text-gray-400">対応記録なし</p>
  }

  return (
    <div className="space-y-2">
      {visible.map(a => <ActionCard key={a.id} action={a} />)}
    </div>
  )
}

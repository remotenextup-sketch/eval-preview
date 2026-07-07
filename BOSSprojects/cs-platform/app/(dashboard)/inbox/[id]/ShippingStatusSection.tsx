'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { refreshShippingOrder } from './shipping-actions'

export type ShippingOrderData = {
  id: string
  order_number: string | null
  ordered_at: string | null
  total_amount: number | null
  shipment_status: string | null
  carrier: string | null
  tracking_number: string | null
  delivery_date: string | null
  updated_at: string
  items: Array<{ item_name: string | null; quantity: number; unit_price: number | null }>
}

type Props = {
  orderNumber: string | null
  order: ShippingOrderData | null
}

export function ShippingStatusSection({ orderNumber, order }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleRefresh() {
    if (!orderNumber) return
    setError(null)
    startTransition(async () => {
      const result = await refreshShippingOrder(orderNumber)
      if (!result.ok) {
        setError(result.reason ?? '取得に失敗しました')
      } else {
        router.refresh()
      }
    })
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!orderNumber) {
    return <p className="text-xs text-gray-400">注文番号が未登録です</p>
  }

  return (
    <div className="space-y-3">
      {!order ? (
        <p className="text-xs text-gray-400">配送情報はまだありません</p>
      ) : (
        <div className="space-y-2 text-xs">
          <Row
            label="注文番号"
            value={
              order.order_number
                ? (
                  <a
                    href={`https://order-rp.rms.rakuten.co.jp/order-rb/individual-order-detail-sc/init?orderNumber=${order.order_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-blue-600 hover:underline"
                  >
                    {order.order_number} ↗
                  </a>
                )
                : <span className="font-mono">{order.order_number}</span>
            }
          />
          {order.ordered_at && (
            <Row
              label="注文日"
              value={new Date(order.ordered_at).toLocaleDateString('ja-JP')}
            />
          )}
          {order.items.length > 0 && (
            <div className="flex gap-2">
              <span className="text-gray-400 w-16 flex-shrink-0">商品</span>
              <div className="min-w-0 space-y-0.5">
                {order.items.map((item, i) => (
                  <p key={i} className="text-gray-700 truncate">
                    {item.item_name ?? '─'}
                    {item.quantity > 1 && (
                      <span className="text-gray-400 ml-1">×{item.quantity}</span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}
          {order.shipment_status && (
            <Row
              label="配送状況"
              value={
                <span className="bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                  {order.shipment_status}
                </span>
              }
            />
          )}
          {order.carrier && <Row label="配送会社" value={order.carrier} />}
          {order.tracking_number && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-16 flex-shrink-0">追跡番号</span>
              <span className="font-mono text-gray-700 truncate flex-1 min-w-0">
                {order.tracking_number}
              </span>
              <button
                onClick={() => handleCopy(order.tracking_number!)}
                title="コピー"
                className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-700 transition-colors px-1"
              >
                {copied ? '✓' : '⎘'}
              </button>
            </div>
          )}
          {order.delivery_date && (
            <Row
              label="配送日"
              value={new Date(order.delivery_date).toLocaleDateString('ja-JP')}
            />
          )}
          {order.total_amount != null && (
            <Row
              label="金額"
              value={`${Number(order.total_amount).toLocaleString('ja-JP')}円`}
            />
          )}
          <Row
            label="最終更新"
            value={new Date(order.updated_at).toLocaleString('ja-JP', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          />
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleRefresh}
        disabled={isPending}
        className="w-full text-xs border border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-800 px-2 py-1.5 rounded disabled:opacity-50 transition-colors"
      >
        {isPending ? '取得中...' : '↻ 最新取得'}
      </button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 w-16 flex-shrink-0">{label}</span>
      <span className="text-gray-700 min-w-0 break-all">{value}</span>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { channelMeta } from '@/lib/channel-meta'
import type { InquiryStatus, SourceChannel } from '@/lib/types'

type Inquiry = {
  id: string
  customer_name: string | null
  subject: string | null
  order_number: string | null
  status: InquiryStatus
  source_channel: SourceChannel | null
  received_at: string
  is_angry: boolean | null
  needs_human: boolean | null
  scheduled_reply_at: string | null
}

type Props = {
  inquiries: Inquiry[]
  selectedId?: string
  currentStatus: InquiryStatus
  channel?: string
  tagId?: string
  q?: string
  mine?: boolean
}

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, v)
  }
  const qs = p.toString()
  return qs ? `${base}?${qs}` : base
}

export function InquiryList({ inquiries, selectedId, currentStatus, channel, tagId, q, mine }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    setLoadingId(null)
  }, [pathname])

  if (inquiries.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-8">
        該当する問い合わせはありません
      </p>
    )
  }

  return (
    <>
      {inquiries.map((inq) => {
        const isSelected = selectedId === inq.id
        const isLoading = loadingId === inq.id

        return (
          <Link
            key={inq.id}
            href={buildUrl(`/inbox/${inq.id}`, {
              status: currentStatus,
              channel: channel || undefined,
              tag: tagId,
              q,
              mine: mine ? '1' : undefined,
            })}
            onClick={() => setLoadingId(inq.id)}
            className={`block px-3 py-2.5 border-b border-gray-100 transition-colors relative ${
              isSelected
                ? 'bg-blue-50 border-l-2 border-l-blue-500 pl-2.5'
                : isLoading
                ? 'bg-gray-100'
                : 'hover:bg-gray-50'
            }`}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <div className="flex items-center gap-1 mb-0.5 flex-wrap">
              {inq.is_angry && (
                <span className="text-xs bg-red-500 text-white rounded px-1.5 py-0.5 font-semibold">🔥 要注意</span>
              )}
              {inq.needs_human && (
                <span className="text-xs bg-orange-500 text-white rounded px-1.5 py-0.5 font-semibold">⚠ 要対応</span>
              )}
              {inq.scheduled_reply_at && (
                <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium">📅 送信予約</span>
              )}
              {inq.source_channel && (() => {
                const ch = channelMeta[inq.source_channel] ?? { label: inq.source_channel, className: 'bg-gray-100 text-gray-500' }
                return <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${ch.className}`}>{ch.label}</span>
              })()}
            </div>
            <p className="text-sm font-medium text-gray-900 truncate">
              {inq.customer_name ?? '（名前なし）'}
            </p>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {inq.subject ?? '（件名なし）'}
            </p>
            {inq.order_number && (
              <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                {inq.order_number}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {new Date(inq.received_at).toLocaleString('ja-JP', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </Link>
        )
      })}
    </>
  )
}

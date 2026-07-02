'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { linkInquiryToCustomer, createCustomerProfileFromInquiry } from './customer-actions'
import type { CustomerCandidate, InquiryHistoryItem } from '@/lib/customer-queries'
import type { DbCustomerProfile } from '@/lib/types'

type LinkedProfile = Pick<
  DbCustomerProfile,
  'id' | 'display_name' | 'customer_name' | 'primary_email' | 'customer_email' | 'order_count' | 'inquiry_count' | 'return_count'
>

type Props = {
  inquiryId: string
  linkedProfile: LinkedProfile | null
  candidates: CustomerCandidate[]
  history: InquiryHistoryItem[]
}

const STATUS_LABELS: Record<string, string> = {
  open: '未対応',
  pending: '保留中',
  resolved: '完了',
  spam: 'スパム',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-gray-100 text-gray-600',
  pending: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  spam: 'bg-red-100 text-red-600',
}

export function CustomerLinkSection({ inquiryId, linkedProfile, candidates, history }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleLink(customerProfileId: string) {
    setError(null)
    startTransition(async () => {
      const result = await linkInquiryToCustomer(inquiryId, customerProfileId)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const result = await createCustomerProfileFromInquiry(inquiryId)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  if (linkedProfile) {
    const name = linkedProfile.display_name ?? linkedProfile.customer_name ?? '（名前なし）'
    const email = linkedProfile.primary_email ?? linkedProfile.customer_email

    return (
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs space-y-1">
          <Link
            href={`/customers/${linkedProfile.id}`}
            className="font-semibold text-blue-900 hover:text-blue-700 hover:underline transition-colors"
          >
            {name}
          </Link>
          {email && <p className="text-blue-700">{email}</p>}
          <div className="flex gap-3 pt-1 text-blue-600">
            <span>注文 {linkedProfile.order_count}</span>
            <span>問い合わせ {linkedProfile.inquiry_count}</span>
            <span>返品 {linkedProfile.return_count}</span>
          </div>
        </div>

        {history.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">過去問い合わせ</p>
            <div className="space-y-1.5">
              {history.map((h) => (
                <Link
                  key={h.id}
                  href={`/inbox/${h.id}`}
                  className="block border border-gray-100 rounded-md p-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs text-gray-400">
                      {new Date(h.received_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </span>
                    <div className="flex items-center gap-1">
                      {h.is_angry && (
                        <span className="text-xs bg-red-500 text-white rounded px-1 py-0.5 font-semibold leading-none">🔥</span>
                      )}
                      {h.needs_human && (
                        <span className="text-xs bg-orange-500 text-white rounded px-1 py-0.5 font-semibold leading-none">⚠</span>
                      )}
                      <span className={`text-xs rounded px-1.5 py-0.5 leading-none ${STATUS_COLORS[h.status] ?? STATUS_COLORS.open}`}>
                        {STATUS_LABELS[h.status] ?? h.status}
                      </span>
                    </div>
                  </div>
                  {h.subject && (
                    <p className="text-xs text-gray-700 truncate">{h.subject}</p>
                  )}
                  {h.order_number && (
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{h.order_number}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-500">{error}</p>}

      {candidates.length > 0 ? (
        <div className="space-y-2">
          {candidates.map((c) => {
            const name = c.profile.display_name ?? c.profile.customer_name ?? '（名前なし）'
            const email = c.profile.primary_email ?? c.profile.customer_email
            return (
              <div key={c.profile.id} className="border border-gray-200 rounded-md p-2.5 text-xs space-y-1.5">
                <p className="font-medium text-gray-800">{name}</p>
                {email && <p className="text-gray-500">{email}</p>}
                <div className="flex flex-wrap gap-1">
                  {c.reasons.map((r) => (
                    <span key={r} className="bg-yellow-100 text-yellow-800 rounded px-1.5 py-0.5">{r}</span>
                  ))}
                </div>
                <button
                  onClick={() => handleLink(c.profile.id)}
                  disabled={isPending}
                  className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1.5 rounded disabled:opacity-50 transition-colors"
                >
                  {isPending ? '処理中...' : 'この顧客に紐づけ'}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400">候補が見つかりません</p>
      )}

      <button
        onClick={handleCreate}
        disabled={isPending}
        className="w-full text-xs border border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-800 px-2 py-1.5 rounded disabled:opacity-50 transition-colors"
      >
        {isPending ? '作成中...' : '+ 新規顧客として登録'}
      </button>
    </div>
  )
}

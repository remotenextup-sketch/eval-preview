'use client'

import { useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'
import { mergeCustomerProfile } from './actions'

type Candidate = {
  id: string
  display_name: string | null
  customer_name: string | null
  primary_email: string | null
  customer_email: string | null
  phone: string | null
  inquiry_count: number
  reasons: string[]
}

type Props = {
  candidates: Candidate[]
  targetCustomerId: string
}

export function DuplicateCandidatesSection({ candidates, targetCustomerId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mergingId, setMergingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleMerge(sourceId: string, sourceName: string) {
    const confirmed = window.confirm(
      `「${sourceName}」をこの顧客に統合しますか？\n\nこの操作は取り消せません。統合元の問い合わせ・識別子がすべてこの顧客に移動されます。`
    )
    if (!confirmed) return

    setMergingId(sourceId)
    setErrors((prev) => { const next = { ...prev }; delete next[sourceId]; return next })

    startTransition(async () => {
      const result = await mergeCustomerProfile(sourceId, targetCustomerId)
      setMergingId(null)
      if (result.error) {
        setErrors((prev) => ({ ...prev, [sourceId]: result.error! }))
      } else {
        router.refresh()
      }
    })
  }

  if (candidates.length === 0) {
    return <p className="text-sm text-gray-400">重複候補は見つかりません</p>
  }

  return (
    <div className="space-y-2">
      {candidates.map((c) => {
        const name = c.display_name ?? c.customer_name ?? '（名前なし）'
        const email = c.primary_email ?? c.customer_email
        const isMerging = isPending && mergingId === c.id
        const errMsg = errors[c.id]

        return (
          <div key={c.id} className="border border-gray-200 rounded-md p-3 text-xs space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <p className="font-medium text-gray-800">{name}</p>
                {email && <p className="text-gray-500 truncate">{email}</p>}
                {c.phone && <p className="text-gray-500">{c.phone}</p>}
                <p className="text-gray-400">問い合わせ {c.inquiry_count}件</p>
              </div>
              <button
                onClick={() => handleMerge(c.id, name)}
                disabled={isPending}
                className={`flex-shrink-0 text-xs px-2.5 py-1.5 rounded transition-colors ${
                  isMerging
                    ? 'bg-gray-100 text-gray-400 cursor-wait'
                    : isPending
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-orange-50 text-orange-700 hover:bg-orange-100 cursor-pointer'
                }`}
              >
                {isMerging ? '統合中…' : 'この顧客に統合'}
              </button>
            </div>
            {errMsg && (
              <p className="text-red-500 text-xs">{errMsg}</p>
            )}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {c.reasons.map((r) => (
                <span key={r} className="bg-yellow-100 text-yellow-800 rounded px-1.5 py-0.5">{r}</span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

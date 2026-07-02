'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateStatus } from './actions'
import type { InquiryStatus } from '@/lib/types'

interface Props {
  inquiryId: string
  currentStatus: InquiryStatus
}

export function StatusSelect({ inquiryId, currentStatus }: Props) {
  const [value, setValue] = useState(currentStatus)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <select
      value={value}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as InquiryStatus
        setValue(next)
        startTransition(async () => {
          await updateStatus(inquiryId, next)
          router.refresh()
        })
      }}
      className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white disabled:opacity-50"
    >
      <option value="open">未対応</option>
      <option value="pending">保留中</option>
      <option value="resolved">解決済み</option>
      <option value="spam">スパム</option>
    </select>
  )
}

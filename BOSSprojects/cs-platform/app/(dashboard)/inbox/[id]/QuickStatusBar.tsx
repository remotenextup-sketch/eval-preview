'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateStatus } from './actions'
import type { InquiryStatus } from '@/lib/types'

type Props = {
  inquiryId: string
  currentStatus: InquiryStatus
  lockedByOther?: boolean
}

const ACTIONS: {
  status: InquiryStatus
  label: string
  snooze?: boolean
  solid: string
  outline: string
}[] = [
  {
    status: 'open',
    label: '未対応',
    solid: 'bg-blue-600 text-white shadow-sm',
    outline: 'border border-blue-400 text-blue-600 hover:bg-blue-50',
  },
  {
    status: 'pending',
    label: '保留中',
    snooze: true,
    solid: 'bg-orange-500 text-white shadow-sm',
    outline: 'border border-orange-400 text-orange-600 hover:bg-orange-50',
  },
  {
    status: 'resolved',
    label: '対応完了',
    solid: 'bg-green-600 text-white shadow-sm',
    outline: 'border border-green-400 text-green-600 hover:bg-green-50',
  },
]

export function QuickStatusBar({ inquiryId, currentStatus, lockedByOther }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleStatus(status: InquiryStatus, snooze?: boolean) {
    if (status === currentStatus || lockedByOther) return
    startTransition(async () => {
      await updateStatus(inquiryId, status, snooze)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2 px-5 py-2 bg-white border-b border-gray-100 flex-shrink-0">
      {ACTIONS.map(({ status, label, snooze, solid, outline }) => {
        const isActive = currentStatus === status
        return (
          <button
            key={status}
            onClick={() => handleStatus(status, snooze)}
            disabled={isPending || isActive || lockedByOther}
            className={`text-xs px-3.5 py-1.5 rounded-full font-semibold transition-colors disabled:cursor-default ${
              isActive ? solid : `bg-white ${outline}`
            } ${lockedByOther ? 'opacity-40' : ''}`}
          >
            {label}
          </button>
        )
      })}
      {isPending && <span className="text-xs text-gray-400">更新中...</span>}
    </div>
  )
}

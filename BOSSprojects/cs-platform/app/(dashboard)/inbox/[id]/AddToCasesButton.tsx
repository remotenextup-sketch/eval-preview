'use client'

import { useState, useTransition } from 'react'
import { addToKnowledgeCases } from './actions'

type Status = 'idle' | 'pending' | 'done' | 'error'

export function AddToCasesButton({
  inquiryMessageId,
  inquiryId,
}: {
  inquiryMessageId: string
  inquiryId: string
}) {
  const [status, setStatus] = useState<Status>('idle')
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (status !== 'idle') return
    startTransition(async () => {
      setStatus('pending')
      const result = await addToKnowledgeCases(inquiryMessageId, inquiryId)
      setStatus(result.error ? 'error' : 'done')
    })
  }

  if (status === 'done') {
    return (
      <span className="text-xs text-green-600 mt-1 inline-block">
        ✅ 事例追加済み
      </span>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title={status === 'error' ? '登録に失敗しました。再試行してください' : undefined}
      className={`text-xs mt-1 px-2 py-0.5 rounded transition-colors ${
        status === 'error'
          ? 'text-red-500 hover:text-red-700'
          : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
      } disabled:opacity-50`}
    >
      {status === 'error' ? '⚠ 再試行' : isPending ? '追加中...' : '事例に追加'}
    </button>
  )
}

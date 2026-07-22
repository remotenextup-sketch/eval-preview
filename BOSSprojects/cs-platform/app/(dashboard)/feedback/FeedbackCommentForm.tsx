'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addFeedbackComment } from './actions'

export function FeedbackCommentForm({ feedbackId }: { feedbackId: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body = ref.current?.value.trim()
    if (!body) return
    setError(null)
    startTransition(async () => {
      const result = await addFeedbackComment(feedbackId, body)
      if (result?.error) {
        setError(result.error)
        return
      }
      if (ref.current) ref.current.value = ''
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <textarea
        ref={ref}
        placeholder="コメントを入力..."
        rows={3}
        disabled={isPending}
        className="w-full text-sm border border-gray-200 rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="text-xs bg-gray-700 hover:bg-gray-900 text-white px-3 py-1.5 rounded disabled:opacity-50"
      >
        {isPending ? '送信中...' : 'コメント追加'}
      </button>
    </form>
  )
}

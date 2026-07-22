'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addComment } from './actions'

type Props = {
  inquiryId: string
}

export function CommentForm({ inquiryId }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body = ref.current?.value.trim()
    if (!body) return
    setErrorMsg(null)
    startTransition(async () => {
      const result = await addComment(inquiryId, body)
      if (result?.error) {
        setErrorMsg(result.error)
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
        placeholder="内部コメントを入力..."
        rows={3}
        disabled={isPending}
        className="w-full text-sm border border-gray-200 rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:opacity-60"
      />
      {errorMsg && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}
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

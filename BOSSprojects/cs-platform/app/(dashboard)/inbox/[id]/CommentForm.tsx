'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addComment } from './actions'

type Props = {
  inquiryId: string
  lockedByOther?: boolean
}

export function CommentForm({ inquiryId, lockedByOther }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (lockedByOther) return
    const body = ref.current?.value.trim()
    if (!body) return
    startTransition(async () => {
      await addComment(inquiryId, body)
      if (ref.current) ref.current.value = ''
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <textarea
        ref={ref}
        placeholder={lockedByOther ? '他のユーザーが対応中です' : '内部コメントを入力...'}
        rows={3}
        disabled={isPending || lockedByOther}
        className="w-full text-sm border border-gray-200 rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={isPending || lockedByOther}
        className="text-xs bg-gray-700 hover:bg-gray-900 text-white px-3 py-1.5 rounded disabled:opacity-50"
      >
        {isPending ? '送信中...' : 'コメント追加'}
      </button>
    </form>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { updateCustomerMemo } from './actions'

type Props = {
  customerId: string
  initialMemo: string | null
}

export function MemoForm({ customerId, initialMemo }: Props) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [memo, setMemo] = useState(initialMemo ?? '')
  const [saved, setSaved] = useState(initialMemo ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateCustomerMemo(customerId, memo)
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(memo)
        setEditing(false)
      }
    })
  }

  function handleCancel() {
    setMemo(saved)
    setEditing(false)
    setError(null)
  }

  if (!editing) {
    return (
      <div>
        {saved ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{saved}</p>
        ) : (
          <p className="text-sm text-gray-400">メモなし</p>
        )}
        <button
          onClick={() => setEditing(true)}
          className="mt-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          {saved ? '編集' : '+ メモを追加'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-500">{error}</p>}
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={4}
        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
        placeholder="顧客に関するメモを入力..."
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded disabled:opacity-50 transition-colors"
        >
          {isPending ? '保存中...' : '保存'}
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 disabled:opacity-50 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}

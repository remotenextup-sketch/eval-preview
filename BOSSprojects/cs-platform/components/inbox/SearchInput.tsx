'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Tag = { id: string; name: string; color: string }

type Props = {
  defaultValue: string
  defaultTagId: string
  status: string
  tags: Tag[]
}

export function SearchInput({ defaultValue, defaultTagId, status, tags }: Props) {
  const router = useRouter()
  const [q, setQ] = useState(defaultValue)
  const [tagId, setTagId] = useState(defaultTagId)

  const hasFilter = q.trim() !== '' || tagId !== ''

  function navigate(nextQ: string, nextTagId: string) {
    const params = new URLSearchParams({ status })
    if (nextQ.trim()) params.set('q', nextQ.trim())
    if (nextTagId) params.set('tag', nextTagId)
    router.push(`/inbox?${params.toString()}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate(q, tagId)
  }

  function handleTagChange(next: string) {
    setTagId(next)
    navigate(q, next)
  }

  function handleClear() {
    setQ('')
    setTagId('')
    router.push(`/inbox?status=${status}`)
  }

  return (
    <div className="space-y-1.5">
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="キーワードで検索"
          className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 pr-7 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); navigate('', tagId) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-400 hover:text-gray-600 leading-none"
            aria-label="キーワードをクリア"
          >
            ×
          </button>
        )}
      </form>
      <div className="flex gap-1.5 items-center">
        <select
          value={tagId}
          onChange={(e) => handleTagChange(e.target.value)}
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">タグ指定なし</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>
        {hasFilter && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border border-gray-200 whitespace-nowrap"
          >
            クリア
          </button>
        )}
      </div>
    </div>
  )
}

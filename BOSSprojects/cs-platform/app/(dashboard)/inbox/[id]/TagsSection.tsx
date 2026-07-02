'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addTag, removeTag } from './actions'
import type { DbTag } from '@/lib/types'

type Props = {
  inquiryId: string
  currentTags: DbTag[]
  allTags: DbTag[]
  lockedByOther?: boolean
}

export function TagsSection({ inquiryId, currentTags, allTags, lockedByOther }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectValue, setSelectValue] = useState('')

  const currentIds = new Set(currentTags.map((t) => t.id))
  const addableTags = allTags.filter((t) => !currentIds.has(t.id))

  function handleAdd(tagId: string) {
    if (!tagId) return
    setSelectValue('')
    startTransition(async () => {
      await addTag(inquiryId, tagId)
      router.refresh()
    })
  }

  function handleRemove(tagId: string) {
    startTransition(async () => {
      await removeTag(inquiryId, tagId)
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {currentTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => handleRemove(tag.id)}
              disabled={isPending || lockedByOther}
              className="hover:opacity-70 disabled:opacity-50 leading-none"
              aria-label={`${tag.name}を削除`}
            >
              ×
            </button>
          </span>
        ))}
        {currentTags.length === 0 && (
          <span className="text-xs text-gray-400">タグなし</span>
        )}
      </div>
      {addableTags.length > 0 && (
        <select
          value={selectValue}
          onChange={(e) => handleAdd(e.target.value)}
          disabled={isPending || lockedByOther}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 disabled:opacity-50"
        >
          <option value="">+ タグを追加</option>
          {addableTags.map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}

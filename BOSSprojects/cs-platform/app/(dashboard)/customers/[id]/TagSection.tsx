'use client'

import { useTransition, useState, useRef, useEffect } from 'react'
import { addCustomerTag, removeCustomerTag } from './actions'

type TagDef = { id: string; name: string; color: string }

type Props = {
  customerId: string
  currentTags: TagDef[]
  allTags: TagDef[]
}

export function TagSection({ customerId, currentTags, allTags }: Props) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const appliedIds = new Set(currentTags.map((t) => t.id))
  const availableTags = allTags.filter((t) => !appliedIds.has(t.id))

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  function handleAdd(tag: TagDef) {
    setOpen(false)
    setError(null)
    startTransition(async () => {
      const result = await addCustomerTag(customerId, tag.id, tag.name)
      if (result.error) setError(result.error)
    })
  }

  function handleRemove(tag: TagDef) {
    setError(null)
    startTransition(async () => {
      const result = await removeCustomerTag(customerId, tag.id, tag.name)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {currentTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: tag.color + '22', color: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => handleRemove(tag)}
              disabled={isPending}
              className="hover:opacity-60 transition-opacity leading-none"
              aria-label={`${tag.name}を削除`}
            >
              ×
            </button>
          </span>
        ))}

        {availableTags.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              disabled={isPending}
              className="text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-0.5 transition-colors"
            >
              + タグを追加
            </button>
            {open && (
              <div className="absolute left-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-md shadow-md py-1 min-w-[120px]">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAdd(tag)}
                    className="w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {currentTags.length === 0 && availableTags.length === 0 && (
          <p className="text-xs text-gray-400">タグなし</p>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

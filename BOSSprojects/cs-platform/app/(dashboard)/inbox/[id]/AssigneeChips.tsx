'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addAssignee, removeAssignee } from './actions'

interface User {
  id: string
  display_name: string
}

interface Props {
  inquiryId: string
  assignees: User[]
  allUsers: User[]
}

export function AssigneeChips({ inquiryId, assignees, allUsers }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const assignedIds = new Set(assignees.map((a) => a.id))
  const candidates = allUsers.filter((u) => !assignedIds.has(u.id))

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleAdd(userId: string) {
    setOpen(false)
    startTransition(async () => {
      await addAssignee(inquiryId, userId)
      router.refresh()
    })
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      await removeAssignee(inquiryId, userId)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {assignees.length === 0 && (
        <span className="text-xs text-gray-400">未担当</span>
      )}
      {assignees.map((a) => (
        <span
          key={a.id}
          className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5"
        >
          {a.display_name}
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleRemove(a.id)}
            className="text-blue-400 hover:text-blue-700 leading-none disabled:opacity-40"
            aria-label={`${a.display_name}を外す`}
          >
            ×
          </button>
        </span>
      ))}

      {candidates.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setOpen((v) => !v)}
            className="text-xs border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 rounded-full px-2 py-0.5 disabled:opacity-40"
          >
            + 追加
          </button>
          {open && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-md shadow-lg min-w-[120px] py-1">
              {candidates.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleAdd(u.id)}
                  className="w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50 text-gray-700"
                >
                  {u.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

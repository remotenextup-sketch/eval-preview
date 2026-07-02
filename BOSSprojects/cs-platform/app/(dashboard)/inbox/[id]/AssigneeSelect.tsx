'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateAssignee } from './actions'

interface User {
  id: string
  display_name: string
}

interface Props {
  inquiryId: string
  currentAssigneeId: string | null
  users: User[]
  lockedByOther?: boolean
}

export function AssigneeSelect({ inquiryId, currentAssigneeId, users, lockedByOther }: Props) {
  const [value, setValue] = useState(currentAssigneeId ?? '')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const currentUser = users.find((u) => u.id === value)
  const initials = currentUser ? currentUser.display_name.charAt(0) : '─'

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0 select-none">
        {initials}
      </div>
      <select
        value={value}
        disabled={isPending || lockedByOther}
        onChange={(e) => {
          const next = e.target.value
          setValue(next)
          startTransition(async () => {
            await updateAssignee(inquiryId, next || null)
            router.refresh()
          })
        }}
        className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white disabled:opacity-50 max-w-[128px] truncate"
      >
        <option value="">未担当</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.display_name}</option>
        ))}
      </select>
    </div>
  )
}

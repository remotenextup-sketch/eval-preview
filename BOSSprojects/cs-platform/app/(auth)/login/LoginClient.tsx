'use client'

import { useState, useTransition } from 'react'
import { loginAs, addCsMember, removeCsMember } from './actions'

interface Member {
  id: string
  display_name: string
  email: string
}

export function LoginClient({ members }: { members: Member[] }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [newName, setNewName] = useState('')

  function handleSelect(email: string) {
    if (editMode) return
    setError(null)
    setLoadingEmail(email)
    startTransition(async () => {
      const result = await loginAs(email)
      if (result?.error) {
        setError(result.error)
        setLoadingEmail(null)
      }
    })
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      await removeCsMember(userId)
    })
  }

  function handleAdd() {
    if (!newName.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await addCsMember(newName.trim())
      if (result?.error) {
        setError(result.error)
      } else {
        setNewName('')
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 shadow-sm p-8">
        <div className="flex items-start justify-between mb-1">
          <h1 className="text-xl font-semibold text-gray-900">CS運営プラットフォーム</h1>
          <button
            type="button"
            onClick={() => { setEditMode(v => !v); setError(null) }}
            className="text-xs text-gray-400 hover:text-gray-600 mt-1 ml-2 shrink-0"
          >
            {editMode ? '完了' : '編集'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          {editMode ? 'メンバーを管理してください' : '担当者を選択してください'}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {members.map(member => (
            <div key={member.id} className="relative">
              <button
                type="button"
                disabled={isPending || editMode}
                onClick={() => handleSelect(member.email)}
                className="w-full py-5 px-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-sm font-medium text-gray-800 hover:text-blue-700 disabled:opacity-50 transition-colors text-center"
              >
                {loadingEmail === member.email ? '...' : member.display_name}
              </button>
              {editMode && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRemove(member.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs flex items-center justify-center leading-none disabled:opacity-50"
                  aria-label={`${member.display_name}を削除`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {editMode && (
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="名前を入力"
              className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              disabled={isPending || !newName.trim()}
              onClick={handleAdd}
              className="text-sm bg-gray-700 hover:bg-gray-900 text-white px-3 py-2 rounded-md disabled:opacity-50"
            >
              追加
            </button>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
      </div>
    </div>
  )
}

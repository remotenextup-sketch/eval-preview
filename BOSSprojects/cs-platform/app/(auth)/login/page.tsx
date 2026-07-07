'use client'

import { useState, useTransition } from 'react'
import { CS_MEMBERS } from '@/lib/cs-members'
import { loginAs } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null)

  function handleSelect(email: string) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 shadow-sm p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">CS運営プラットフォーム</h1>
        <p className="text-sm text-gray-500 mb-6">担当者を選択してください</p>
        <div className="grid grid-cols-2 gap-3">
          {CS_MEMBERS.map(member => (
            <button
              key={member.email}
              type="button"
              disabled={isPending}
              onClick={() => handleSelect(member.email)}
              className="py-5 px-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-sm font-medium text-gray-800 hover:text-blue-700 disabled:opacity-50 transition-colors text-center"
            >
              {loadingEmail === member.email ? '...' : member.name}
            </button>
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'

const COOLDOWN_MS = 5_000
const AUTO_REFRESH_MS = 60_000

type Props = {
  className?: string
  showLabel?: boolean
}

export function RefreshButton({ className = '', showLabel = true }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null)
  const lastRefreshAt = useRef<number>(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(ok: boolean, message: string) {
    setToast({ ok, message })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  const doRefresh = useCallback((manual: boolean) => {
    const now = Date.now()
    if (isPending) return
    if (now - lastRefreshAt.current < COOLDOWN_MS) {
      if (manual) showToast(false, '5秒間隔でお待ちください')
      return
    }
    lastRefreshAt.current = now
    startTransition(() => {
      router.refresh()
    })
    setLastUpdated(new Date())
    if (manual) showToast(true, '最新状態に更新しました')
  }, [isPending, router])

  // 60秒自動更新 — 入力中はスキップ
  useEffect(() => {
    const id = setInterval(() => {
      const el = document.activeElement
      const isTyping =
        el?.tagName === 'TEXTAREA' ||
        (el?.tagName === 'INPUT' &&
          !['button', 'submit', 'checkbox', 'radio'].includes(
            (el as HTMLInputElement).type,
          ))
      if (!isTyping) doRefresh(false)
    }, AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [doRefresh])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const timeStr = lastUpdated?.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <button
        onClick={() => doRefresh(true)}
        disabled={isPending}
        title="最新状態に更新"
        className={`inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${className}`}
      >
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 ${isPending ? 'animate-spin' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
            clipRule="evenodd"
          />
        </svg>
        {showLabel && (
          <span>{isPending ? '更新中...' : '最新に更新'}</span>
        )}
        {timeStr && !isPending && (
          <span className="text-gray-400">{timeStr}</span>
        )}
      </button>

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[200] flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium pointer-events-none ${
            toast.ok ? 'bg-gray-800 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.ok ? (
            <svg className="w-4 h-4 text-green-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          {toast.message}
        </div>
      )}
    </>
  )
}

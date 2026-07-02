'use client'

import { useState } from 'react'
import type { ConsultResult, ConsultResultItem } from '@/app/api/feedback/ai-consult/route'

const PRIORITY_STYLE: Record<string, string> = {
  高: 'bg-red-100 text-red-700 border-red-200',
  中: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  低: 'bg-gray-100 text-gray-600 border-gray-200',
}

const CATEGORY_STYLE: Record<string, string> = {
  ui:      'bg-blue-100 text-blue-700',
  db:      'bg-orange-100 text-orange-700',
  complex: 'bg-purple-100 text-purple-700',
}

const CATEGORY_LABEL: Record<string, string> = {
  ui:      'UI修正',
  db:      'DB/ロジック',
  complex: '手動対応',
}

function PrioritySection({
  label,
  items,
}: {
  label: string
  items: ConsultResultItem[]
}) {
  if (items.length === 0) return null
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        優先度：{label}（{items.length}件）
      </h4>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-md border px-3 py-2.5 ${PRIORITY_STYLE[item.priority_assessment] ?? 'bg-gray-50 border-gray-200'}`}
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${CATEGORY_STYLE[item.category] ?? 'bg-gray-100 text-gray-600'}`}>
                {CATEGORY_LABEL[item.category] ?? item.category}
              </span>
              <span className="text-sm font-medium text-gray-900 truncate">{item.title}</span>
            </div>
            <p className="text-xs text-gray-700 mt-0.5">{item.approach}</p>
            {item.fix_files.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {item.fix_files.map((f) => (
                  <span key={f} className="text-xs font-mono bg-white/60 border border-current/20 rounded px-1.5 py-0.5 text-gray-500">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function AiConsultButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ConsultResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [open, setOpen] = useState(false)

  async function handleClick() {
    setState('loading')
    setOpen(true)
    try {
      const res = await fetch('/api/feedback/ai-consult', { method: 'POST' })
      const data = await res.json()
      if (!data.ok) {
        throw new Error(data.message ?? data.reason ?? `エラーが発生しました (HTTP ${res.status})`)
      }
      setResult(data as ConsultResult)
      setState('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setState('error')
    }
  }

  const high    = result?.items.filter(i => i.priority_assessment === '高') ?? []
  const mid     = result?.items.filter(i => i.priority_assessment === '中') ?? []
  const low     = result?.items.filter(i => i.priority_assessment === '低') ?? []

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={state === 'loading'}
        className="text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
      >
        {state === 'loading' ? (
          <>
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            AI分析中…
          </>
        ) : (
          <>🤖 AIに相談</>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">
                🤖 AIレポート
                {result && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    未対応 {result.total}件を分析
                  </span>
                )}
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {state === 'loading' && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <svg className="animate-spin h-6 w-6 text-purple-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <p className="text-sm text-gray-500">Claude APIで分析中です。しばらくお待ちください…</p>
                </div>
              )}

              {state === 'error' && (
                <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  エラーが発生しました：{errorMsg}
                </div>
              )}

              {state === 'done' && result && (
                <>
                  {/* サマリー */}
                  <div className="rounded-md bg-purple-50 border border-purple-100 px-3 py-2.5">
                    <p className="text-xs font-semibold text-purple-700 mb-1">まとめ</p>
                    <p className="text-sm text-gray-700">{result.summary}</p>
                  </div>

                  {/* 優先度別 */}
                  <PrioritySection label="高" items={high} />
                  <PrioritySection label="中" items={mid} />
                  <PrioritySection label="低" items={low} />

                  {result.total === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">未対応の案件はありません</p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {state === 'done' && (
              <div className="px-4 py-2.5 border-t border-gray-100 flex justify-between items-center">
                <p className="text-xs text-gray-400">
                  Chatwork通知を送信済み（設定されている場合）
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="text-xs text-gray-500 hover:text-gray-800"
                >
                  閉じる
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

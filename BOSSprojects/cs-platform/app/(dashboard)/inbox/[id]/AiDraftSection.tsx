'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { generateAiDraft, submitAiDraftFeedback } from './actions'
import type { AiLogFeedback } from '@/lib/types'

type Props = {
  inquiryId: string
  existingDraft: { aiLogId: string; body: string } | null
  lockedByOther?: boolean
}

type Mode = 'idle' | 'preview' | 'editing' | 'done'

export function AiDraftSection({ inquiryId, existingDraft, lockedByOther }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState(existingDraft)
  const [editText, setEditText] = useState('')
  const [mode, setMode] = useState<Mode>(existingDraft ? 'preview' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const autoGenRef = useRef(false)

  useEffect(() => {
    if (existingDraft || autoGenRef.current) return
    autoGenRef.current = true
    setError(null)
    startTransition(async () => {
      const result = await generateAiDraft(inquiryId)
      if ('error' in result) {
        setError(result.error)
      } else {
        setDraft({ aiLogId: result.aiLogId, body: result.draft })
        setMode('preview')
        window.dispatchEvent(new CustomEvent('ai-draft-insert', { detail: { body: result.draft } }))
        router.refresh()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      const result = await generateAiDraft(inquiryId)
      if ('error' in result) {
        setError(result.error)
      } else {
        setDraft({ aiLogId: result.aiLogId, body: result.draft })
        setMode('preview')
        router.refresh()
      }
    })
  }

  function insertToReplyForm(body: string) {
    window.dispatchEvent(new CustomEvent('ai-draft-insert', { detail: { body } }))
  }

  function handleFeedback(feedback: AiLogFeedback) {
    if (!draft) return
    startTransition(async () => {
      await submitAiDraftFeedback(inquiryId, draft.aiLogId, feedback)
      if (feedback === 'accepted') {
        insertToReplyForm(draft.body)
      }
      setMode('done')
      router.refresh()
    })
  }

  function handleEditStart() {
    setEditText(draft?.body ?? '')
    setMode('editing')
  }

  function handleEditConfirm() {
    if (!draft) return
    startTransition(async () => {
      await submitAiDraftFeedback(inquiryId, draft.aiLogId, 'edited', {
        editedBody: editText,
      })
      setDraft({ ...draft, body: editText })
      insertToReplyForm(editText)
      setMode('preview')
      router.refresh()
    })
  }

  if (mode === 'idle') {
    return (
      <div className="space-y-2">
        {error && <p className="text-xs text-red-500">{error}</p>}
        {isPending ? (
          <p className="text-xs text-gray-400 text-center py-2">AI返信案を生成中...</p>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="w-full text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-md disabled:opacity-50"
          >
            AI返信案を生成
          </button>
        )}
      </div>
    )
  }

  if (mode === 'editing') {
    return (
      <div className="space-y-2">
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          rows={8}
          className="w-full text-xs border border-blue-300 rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
        />
        <div className="flex gap-1">
          <button
            onClick={handleEditConfirm}
            disabled={isPending || !editText.trim()}
            className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1.5 rounded disabled:opacity-50"
          >
            {isPending ? '保存中...' : '確定'}
          </button>
          <button
            onClick={() => setMode('preview')}
            disabled={isPending}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 disabled:opacity-50"
          >
            キャンセル
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'done') {
    return (
      <div className="space-y-2">
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
          {draft?.body}
        </div>
        <p className="text-xs text-gray-400 text-center">フィードバック済み</p>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="w-full text-xs text-purple-600 hover:text-purple-800 border border-purple-200 hover:border-purple-400 px-2 py-1.5 rounded disabled:opacity-50 transition-colors"
        >
          {isPending ? '生成中...' : '再生成'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="bg-purple-50 border border-purple-200 rounded-md p-3 text-xs text-purple-900 whitespace-pre-wrap leading-relaxed">
        {draft?.body}
      </div>
      {lockedByOther ? (
        <p className="text-xs text-gray-400 text-center py-1">他のユーザーが対応中のため操作できません</p>
      ) : (
        <>
          <div className="flex gap-1">
            <button
              onClick={() => handleFeedback('accepted')}
              disabled={isPending}
              className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1.5 rounded disabled:opacity-50"
            >
              採用
            </button>
            <button
              onClick={handleEditStart}
              disabled={isPending}
              className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1.5 rounded disabled:opacity-50"
            >
              編集
            </button>
            <button
              onClick={() => handleFeedback('rejected')}
              disabled={isPending}
              className="flex-1 text-xs bg-gray-400 hover:bg-gray-500 text-white px-2 py-1.5 rounded disabled:opacity-50"
            >
              却下
            </button>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="w-full text-xs text-purple-600 hover:text-purple-800 border border-purple-200 hover:border-purple-400 px-2 py-1.5 rounded disabled:opacity-50 transition-colors"
          >
            {isPending ? '生成中...' : '再生成'}
          </button>
        </>
      )}
    </div>
  )
}

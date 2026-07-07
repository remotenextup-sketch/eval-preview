'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { sendReply, acquireLock, releaseLock, scheduleReply, fetchTemplates, recordTemplateUse } from './actions'
import type { TemplateItem } from './actions'
import { emitToast } from '@/components/ui/toast-emitter'

type SendAction = 'pending' | 'pending_tomorrow' | 'pending_monday' | 'resolved'

type LockStatus =
  | { state: 'unlocked' }
  | { state: 'locked_by_me' }
  | { state: 'locked_by_other'; lockedByName: string }

const LOCK_TIMEOUT_MS = 30 * 60 * 1000

function deriveInitialLockStatus(
  currentUserId: string,
  lockedById: string | null,
  lockedByName: string | null,
  lockedAt: string | null,
): LockStatus {
  if (!lockedById || !lockedAt) return { state: 'unlocked' }
  const expired = Date.now() - new Date(lockedAt).getTime() > LOCK_TIMEOUT_MS
  if (expired) return { state: 'unlocked' }
  if (lockedById === currentUserId) return { state: 'locked_by_me' }
  return { state: 'locked_by_other', lockedByName: lockedByName ?? '他のユーザー' }
}

const TAB_ALL = 'すべて'
const TAB_FREQUENT = 'よく使う'

function TemplatePanel({
  templates,
  loading,
  search,
  onSearchChange,
  onSelect,
  onClose,
}: {
  templates: TemplateItem[] | null
  loading: boolean
  search: string
  onSearchChange: (v: string) => void
  onSelect: (t: TemplateItem) => void
  onClose: () => void
}) {
  const all = templates ?? []
  const hasFrequent = all.some(t => t.use_count > 0)
  const categories = [...new Set(all.map(t => t.category || 'その他'))]
  const tabs = [TAB_ALL, ...(hasFrequent ? [TAB_FREQUENT] : []), ...categories]

  const [activeTab, setActiveTab] = useState(TAB_ALL)
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  const textFiltered = search
    ? all.filter(t => t.phrase.includes(search) || (t.category ?? '').includes(search) || t.body.includes(search))
    : all

  const displayed = (() => {
    if (search) return textFiltered
    if (activeTab === TAB_ALL) return all
    if (activeTab === TAB_FREQUENT) return [...all].sort((a, b) => b.use_count - a.use_count).filter(t => t.use_count > 0).slice(0, 5)
    return all.filter(t => (t.category || 'その他') === activeTab)
  })()

  const hoveredTemplate = hoveredId !== null ? all.find(t => t.id === hoveredId) ?? null : null

  return (
    <div className="mb-2 border border-green-200 rounded-lg bg-green-50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-green-200 bg-green-100">
        <span className="text-xs font-semibold text-green-800">テンプレート選択</span>
        <button onClick={onClose} className="text-green-600 hover:text-green-900 text-xs">✕</button>
      </div>

      <div className="px-3 py-2 border-b border-green-100">
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="検索..."
          className="w-full text-xs border border-green-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400 bg-white"
          autoFocus
        />
      </div>

      {!search && (
        <div className="flex gap-0 border-b border-green-200 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-green-600 text-green-800 font-semibold bg-white'
                  : 'border-transparent text-gray-500 hover:text-green-700 hover:bg-green-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-56 overflow-y-auto">
        {loading && (
          <p className="text-xs text-gray-400 text-center py-4">読み込み中...</p>
        )}
        {!loading && displayed.map(t => (
          <TemplateRow key={t.id} t={t} onSelect={onSelect} onHover={setHoveredId} />
        ))}
        {!loading && displayed.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">テンプレートがありません</p>
        )}
      </div>
      {hoveredTemplate && (
        <div className="border-t border-green-200 px-3 py-2 bg-white max-h-28 overflow-y-auto">
          <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{hoveredTemplate.body}</p>
        </div>
      )}
    </div>
  )
}

function TemplateRow({ t, onSelect, onHover }: { t: TemplateItem; onSelect: (t: TemplateItem) => void; onHover: (id: number | null) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(t)}
      onMouseEnter={() => onHover(t.id)}
      onMouseLeave={() => onHover(null)}
      className="w-full text-left px-3 py-2 hover:bg-green-100 transition-colors group"
    >
      <p className="text-xs font-medium text-gray-800 group-hover:text-green-800 truncate">{t.phrase}</p>
      <p className="text-xs text-gray-400 truncate mt-0.5">{t.body.slice(0, 60)}...</p>
    </button>
  )
}

function localDatetimeMin(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() + 1)
  return now.toISOString().slice(0, 16)
}

type Props = {
  inquiryId: string
  aiDraftBody?: string
  currentUserId: string
  initialLockedById: string | null
  initialLockedByName: string | null
  initialLockedAt: string | null
}

export function ReplyForm({
  inquiryId,
  aiDraftBody,
  currentUserId,
  initialLockedById,
  initialLockedByName,
  initialLockedAt,
}: Props) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [aiDraftInserted, setAiDraftInserted] = useState(false)
  const [aiDraftModified, setAiDraftModified] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isSending, startSendTransition] = useTransition()
  const [isLocking, startLockTransition] = useTransition()
  const [isScheduling, startScheduleTransition] = useTransition()
  const [lockStatus, setLockStatus] = useState<LockStatus>(() =>
    deriveInitialLockStatus(currentUserId, initialLockedById, initialLockedByName, initialLockedAt)
  )
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<TemplateItem[] | null>(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const lockAttempted = useRef(false)

  const tryAcquireLock = useCallback(() => {
    if (lockAttempted.current) return
    if (lockStatus.state !== 'unlocked') return
    lockAttempted.current = true
    startLockTransition(async () => {
      const result = await acquireLock(inquiryId)
      if (result.success) {
        setLockStatus({ state: 'locked_by_me' })
      } else {
        lockAttempted.current = false
        setLockStatus({ state: 'locked_by_other', lockedByName: result.lockedByName })
      }
    })
  }, [inquiryId, lockStatus.state])

  async function handleOpenTemplates() {
    setShowTemplates(v => !v)
    if (templates === null) {
      setLoadingTemplates(true)
      const list = await fetchTemplates()
      setTemplates(list)
      setLoadingTemplates(false)
    }
  }

  function handleSelectTemplate(t: TemplateItem) {
    setBody(prev => prev.trim() ? `${prev}\n\n${t.body}` : t.body)
    setShowTemplates(false)
    setTemplateSearch('')
    tryAcquireLock()
    recordTemplateUse(t.id)
  }

  useEffect(() => {
    function onAiDraftInsert(e: Event) {
      setBody((e as CustomEvent<{ body: string }>).detail.body)
      setAiDraftInserted(true)
      setAiDraftModified(false)
      tryAcquireLock()
    }
    window.addEventListener('ai-draft-insert', onAiDraftInsert)
    return () => window.removeEventListener('ai-draft-insert', onAiDraftInsert)
  }, [tryAcquireLock])

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setSendError(null)
    setBody(e.target.value)
    if (aiDraftInserted) setAiDraftModified(true)
    if (e.target.value.length > 0) {
      tryAcquireLock()
    }
  }

  function handleRelease() {
    startLockTransition(async () => {
      await releaseLock(inquiryId)
      setLockStatus({ state: 'unlocked' })
      setBody('')
      setAiDraftInserted(false)
      setAiDraftModified(false)
      lockAttempted.current = false
      router.refresh()
    })
  }

  function handleSend(action: SendAction) {
    if (!body.trim() || lockStatus.state !== 'locked_by_me') return
    startSendTransition(async () => {
      const result = await sendReply(inquiryId, body.trim(), action, aiDraftInserted, aiDraftModified)
      if (result.error) {
        setSendError(result.error)
        emitToast(result.error, 'error')
      } else {
        setSendError(null)
        setBody('')
        setAiDraftInserted(false)
        setAiDraftModified(false)
        setLockStatus({ state: 'unlocked' })
        lockAttempted.current = false
        emitToast('返信を送信しました')
        router.refresh()
      }
    })
  }

  function handleScheduleConfirm() {
    if (!body.trim() || !scheduleAt) return
    setScheduleError(null)
    startScheduleTransition(async () => {
      const result = await scheduleReply(inquiryId, body.trim(), new Date(scheduleAt).toISOString())
      if (result.error) {
        setScheduleError(result.error)
        emitToast(result.error, 'error')
      } else {
        setShowSchedule(false)
        setScheduleAt('')
        setBody('')
        setAiDraftInserted(false)
        setAiDraftModified(false)
        emitToast('返信を予約しました')
        router.refresh()
      }
    })
  }

  const isPending = isSending || isLocking || isScheduling
  const isOtherLocked = lockStatus.state === 'locked_by_other'
  const isMeLocked = lockStatus.state === 'locked_by_me'
  const canSend = isMeLocked && body.trim().length > 0 && !isPending
  const canSchedule = body.trim().length > 0 && !isOtherLocked && !isPending

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3">
      {isOtherLocked && (
        <div className="mb-2 flex items-center gap-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2">
          <span className="text-red-500">⚠</span>
          <span>
            <span className="font-semibold">
              {(lockStatus as { state: 'locked_by_other'; lockedByName: string }).lockedByName}
            </span>
            さんが対応中です。編集できません。
          </span>
        </div>
      )}
      {isMeLocked && (
        <div className="mb-2 flex items-center justify-between text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-md px-3 py-2">
          <span>対応中：自分</span>
          <button
            onClick={handleRelease}
            disabled={isPending}
            className="underline hover:text-blue-900 disabled:opacity-50"
          >
            対応解除
          </button>
        </div>
      )}

      {sendError && (
        <div className="mb-2 flex items-start gap-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2">
          <span className="text-red-500 mt-0.5">⚠</span>
          <span>{sendError}</span>
        </div>
      )}

      {!isOtherLocked && (
        <div className="mb-2 flex items-center gap-3">
          {aiDraftBody && (
            <button
              type="button"
              onClick={() => { setBody(aiDraftBody); setAiDraftInserted(true); setAiDraftModified(false); tryAcquireLock() }}
              className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-colors"
            >
              <span className="text-purple-400">▲</span>
              AI下書きを挿入
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenTemplates}
            className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1 transition-colors"
          >
            <span className="text-green-400">☰</span>
            テンプレ
          </button>
        </div>
      )}

      {showTemplates && !isOtherLocked && (
        <TemplatePanel
          templates={templates}
          loading={loadingTemplates}
          search={templateSearch}
          onSearchChange={setTemplateSearch}
          onSelect={handleSelectTemplate}
          onClose={() => { setShowTemplates(false); setTemplateSearch('') }}
        />
      )}

      <textarea
        value={body}
        onChange={handleBodyChange}
        rows={4}
        placeholder={isOtherLocked ? '他のユーザーが対応中のため入力できません' : '返信内容を入力...'}
        disabled={isOtherLocked || isPending}
        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed text-gray-800 placeholder-gray-400 disabled:bg-gray-50 disabled:opacity-70"
      />

      {!isOtherLocked && (
        <div className="flex items-center justify-end gap-2 mt-2 flex-wrap">
          <button
            onClick={() => { setShowSchedule(v => !v); setScheduleError(null) }}
            disabled={!canSchedule}
            className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors"
          >
            送信予約
          </button>
          <button
            onClick={() => handleSend('pending')}
            disabled={!canSend}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors"
          >
            保留
          </button>
          <button
            onClick={() => handleSend('pending_tomorrow')}
            disabled={!canSend}
            className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors"
          >
            スヌーズ（翌日）
          </button>
          <button
            onClick={() => handleSend('pending_monday')}
            disabled={!canSend}
            className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors"
          >
            スヌーズ（週明け）
          </button>
          <button
            onClick={() => handleSend('resolved')}
            disabled={!canSend}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md disabled:opacity-50 transition-colors"
          >
            {isSending ? '送信中...' : '送信して対応完了'}
          </button>
        </div>
      )}

      {showSchedule && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md space-y-2">
          <p className="text-xs font-semibold text-amber-800">送信日時を選択</p>
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            min={localDatetimeMin()}
            className="w-full text-xs border border-amber-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          />
          {scheduleError && (
            <p className="text-xs text-red-500">{scheduleError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleScheduleConfirm}
              disabled={!scheduleAt || !body.trim() || isScheduling}
              className="flex-1 text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors"
            >
              {isScheduling ? '保存中...' : '予約確定'}
            </button>
            <button
              onClick={() => { setShowSchedule(false); setScheduleAt(''); setScheduleError(null) }}
              disabled={isScheduling}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

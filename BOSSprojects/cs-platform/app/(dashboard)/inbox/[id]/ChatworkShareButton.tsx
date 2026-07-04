'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type CwRoom = { id: string; room_id: string; room_name: string }
type CwMember = { id: string; account_id: string; display_name: string; mention_name: string | null }
type CwRoomMember = { room_id: string; member_id: string; is_default_mention: boolean }
type CwShare = { id: string; room_id: string; room_name: string | null; created_at: string }

type InquiryInfo = {
  id: string
  subject: string | null
  customer_name: string | null
  order_number: string | null
  source_channel: string | null
  body_excerpt: string | null
}

type Props = {
  inquiry: InquiryInfo
  rooms: CwRoom[]
  members: CwMember[]
  roomMembers: CwRoomMember[]
  recentShares: CwShare[]
}

export function ChatworkShareButton({ inquiry, rooms, members, roomMembers, recentShares }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [noRoomMsg, setNoRoomMsg] = useState(false)

  // Modal state
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.room_id ?? '')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [bodyExcerpt, setBodyExcerpt] = useState(inquiry.body_excerpt?.slice(0, 300) ?? '')
  const [showPreview, setShowPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false)

  // When selectedRoomId changes, update default mentions
  useEffect(() => {
    const selectedRoom = rooms.find(r => r.room_id === selectedRoomId)
    if (!selectedRoom) {
      setSelectedMemberIds([])
      return
    }
    const defaultMemberIds = roomMembers
      .filter(rm => rm.room_id === selectedRoom.id && rm.is_default_mention)
      .map(rm => rm.member_id)
    setSelectedMemberIds(defaultMemberIds)
    setDuplicateWarning(null)
    setConfirmedDuplicate(false)
  }, [selectedRoomId, rooms, roomMembers])

  function getSelectedMembers(): CwMember[] {
    return members.filter(m => selectedMemberIds.includes(m.id))
  }

  function buildMessage(): string {
    const selectedMembers = getSelectedMembers()
    const mentionsLines = selectedMembers
      .map(m => `[To:${m.account_id}] ${m.display_name}さん`)
      .join('\n')

    const parts: string[] = []

    if (mentionsLines) {
      parts.push(mentionsLines)
      parts.push('')
    }

    parts.push('【CS共有】')
    parts.push('種別：お問い合わせ')
    parts.push(`モール：${inquiry.source_channel ?? '不明'}`)
    parts.push(`件名/概要：${inquiry.subject ?? '（件名なし）'}`)
    parts.push(`注文番号：${inquiry.order_number ?? '−'}`)
    parts.push(`顧客名：${inquiry.customer_name ?? '不明'}`)

    if (comment.trim()) {
      parts.push('')
      parts.push('【相談内容】')
      parts.push(comment.trim())
    }

    if (bodyExcerpt.trim()) {
      parts.push('')
      parts.push('【本文抜粋】')
      parts.push(bodyExcerpt.trim())
    }

    parts.push('')
    parts.push('【確認URL】')
    parts.push(`${typeof window !== 'undefined' ? window.location.origin : ''}/inbox/${inquiry.id}`)

    return parts.join('\n')
  }

  function handleOpen() {
    if (rooms.length === 0) {
      setNoRoomMsg(true)
      return
    }
    setNoRoomMsg(false)
    setIsOpen(true)
    setResult(null)
    setDuplicateWarning(null)
    setConfirmedDuplicate(false)
    setComment('')
    setBodyExcerpt(inquiry.body_excerpt?.slice(0, 300) ?? '')
    // Initialize room and members
    const firstRoom = rooms[0]
    setSelectedRoomId(firstRoom?.room_id ?? '')
  }

  function handleClose() {
    setIsOpen(false)
    setResult(null)
    setDuplicateWarning(null)
    setConfirmedDuplicate(false)
  }

  function toggleMember(memberId: string) {
    setSelectedMemberIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId],
    )
  }

  async function handleSubmit(force = false) {
    const selectedRoom = rooms.find(r => r.room_id === selectedRoomId)
    if (!selectedRoom) return

    // Duplicate check
    if (!force && !confirmedDuplicate) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const duplicate = recentShares.find(
        s => s.room_id === selectedRoomId && s.created_at >= oneHourAgo,
      )
      if (duplicate) {
        const sharedAt = new Date(duplicate.created_at).toLocaleString('ja-JP', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
        setDuplicateWarning(`このルームには${sharedAt}にすでに共有されています。`)
        return
      }
    }

    setIsSubmitting(true)
    setResult(null)

    try {
      const selectedMembers = getSelectedMembers()
      const message = buildMessage()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''

      const res = await fetch('/api/chatwork/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: selectedRoomId,
          room_name: selectedRoom.room_name,
          message,
          inquiry_id: inquiry.id,
          source_type: 'inquiry',
          mall: inquiry.source_channel,
          mentioned_account_ids: selectedMembers.map(m => m.account_id),
          mentioned_names: selectedMembers.map(m => m.display_name),
          comment,
          shared_body: bodyExcerpt,
          source_url: `${origin}/inbox/${inquiry.id}`,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        setResult({ ok: true, message: 'Chatworkへ投稿しました' })
        router.refresh()
      } else {
        setResult({ ok: false, message: json.error ?? 'エラーが発生しました' })
      }
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'エラーが発生しました' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get members for the selected room
  const selectedRoom = rooms.find(r => r.room_id === selectedRoomId)
  const roomMembersForRoom = selectedRoom
    ? roomMembers.filter(rm => rm.room_id === selectedRoom.id)
    : []
  const membersForRoom = roomMembersForRoom.length > 0
    ? members.filter(m => roomMembersForRoom.some(rm => rm.member_id === m.id))
    : members

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
        </svg>
        Chatwork共有
      </button>

      {noRoomMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNoRoomMsg(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <p className="text-sm text-gray-700 mb-3">
              Chatworkルームが未設定です。設定画面から追加してください。
            </p>
            <Link
              href="/settings/chatwork"
              className="text-sm text-blue-600 hover:underline"
              onClick={() => setNoRoomMsg(false)}
            >
              設定画面へ
            </Link>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Chatwork共有</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Room select */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">送信先ルーム</label>
                <select
                  value={selectedRoomId}
                  onChange={e => setSelectedRoomId(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {rooms.map(room => (
                    <option key={room.id} value={room.room_id}>{room.room_name}</option>
                  ))}
                </select>
              </div>

              {/* Member checkboxes */}
              {members.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">メンション</label>
                  <div className="space-y-1">
                    {membersForRoom.map(member => (
                      <label key={member.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(member.id)}
                          onChange={() => toggleMember(member.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{member.display_name}</span>
                        {member.mention_name && (
                          <span className="text-xs text-gray-400">{member.mention_name}</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Comment */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">相談内容</label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="相談内容を入力..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Body excerpt */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">本文抜粋</label>
                <textarea
                  value={bodyExcerpt}
                  onChange={e => setBodyExcerpt(e.target.value)}
                  placeholder="本文抜粋を編集..."
                  rows={4}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Preview toggle */}
              <button
                type="button"
                onClick={() => setShowPreview(v => !v)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {showPreview ? 'プレビューを非表示' : 'プレビューを表示'}
              </button>

              {showPreview && (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <pre className="font-mono text-xs text-gray-700 whitespace-pre-wrap break-words">
                    {buildMessage()}
                  </pre>
                </div>
              )}

              {/* Duplicate warning */}
              {duplicateWarning && (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-3 space-y-2">
                  <p className="text-xs text-orange-700">{duplicateWarning}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedDuplicate(true)
                      setDuplicateWarning(null)
                      handleSubmit(true)
                    }}
                    className="text-xs font-medium text-orange-700 hover:text-orange-900 underline"
                  >
                    再送する
                  </button>
                </div>
              )}

              {/* Result */}
              {result && (
                <p className={`text-xs ${result.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {result.message}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200">
              <button
                onClick={handleClose}
                className="px-4 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting || !selectedRoomId}
                className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '送信中...' : '送信'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

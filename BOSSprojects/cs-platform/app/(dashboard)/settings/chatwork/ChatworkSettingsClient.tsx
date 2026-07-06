'use client'

import { useState, useTransition } from 'react'
import {
  saveApiToken,
  upsertRoom,
  deleteRoom,
  upsertMember,
  deleteMember,
  setRoomMember,
  removeRoomMember,
} from './actions'

type CwSetting = { id: string; api_token: string | null }
type CwRoom = { id: string; room_id: string; room_name: string; description: string | null; is_default: boolean }
type CwMember = { id: string; account_id: string; display_name: string; mention_name: string | null }
type CwRoomMember = { id: string; room_id: string; member_id: string; is_default_mention: boolean }

type Props = {
  setting: CwSetting | null
  rooms: CwRoom[]
  members: CwMember[]
  roomMembers: CwRoomMember[]
}

function InlineMessage({ ok, message }: { ok: boolean; message: string }) {
  return (
    <p className={`text-xs mt-1 ${ok ? 'text-green-600' : 'text-red-600'}`}>{message}</p>
  )
}

export function ChatworkSettingsClient({ setting, rooms, members, roomMembers }: Props) {
  // Section 1: APIトークン
  const [apiToken, setApiToken] = useState('')
  const [tokenMsg, setTokenMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPendingToken, startTokenTransition] = useTransition()

  // Section 2: ルーム管理
  const [newRoomId, setNewRoomId] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDesc, setNewRoomDesc] = useState('')
  const [roomMsg, setRoomMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPendingRoom, startRoomTransition] = useTransition()
  const [isPendingDelRoom, startDelRoomTransition] = useTransition()

  // Section 3: メンバー管理
  const [newAccountId, setNewAccountId] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newMentionName, setNewMentionName] = useState('')
  const [memberMsg, setMemberMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPendingMember, startMemberTransition] = useTransition()
  const [isPendingDelMember, startDelMemberTransition] = useTransition()
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editAccountId, setEditAccountId] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editMentionName, setEditMentionName] = useState('')
  const [isPendingEditMember, startEditMemberTransition] = useTransition()

  // Section 4: ルームとメンバーの紐付け
  const [roomMemberMsg, setRoomMemberMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPendingRoomMember, startRoomMemberTransition] = useTransition()

  // Section 5: テスト送信
  const [testRoomId, setTestRoomId] = useState(rooms[0]?.room_id ?? '')
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPendingTest, startTestTransition] = useTransition()

  const maskedToken = setting?.api_token
    ? setting.api_token.slice(0, 4) + '*'.repeat(12)
    : '未設定'

  function handleSaveToken() {
    if (!apiToken.trim()) return
    setTokenMsg(null)
    startTokenTransition(async () => {
      const result = await saveApiToken(apiToken.trim())
      if (result.error) {
        setTokenMsg({ ok: false, text: result.error })
      } else {
        setTokenMsg({ ok: true, text: '保存しました' })
        setApiToken('')
      }
    })
  }

  function handleAddRoom() {
    if (!newRoomId.trim() || !newRoomName.trim()) return
    setRoomMsg(null)
    startRoomTransition(async () => {
      const result = await upsertRoom({
        room_id: newRoomId.trim(),
        room_name: newRoomName.trim(),
        description: newRoomDesc.trim() || undefined,
      })
      if (result.error) {
        setRoomMsg({ ok: false, text: result.error })
      } else {
        setRoomMsg({ ok: true, text: 'ルームを追加しました' })
        setNewRoomId('')
        setNewRoomName('')
        setNewRoomDesc('')
      }
    })
  }

  function handleDeleteRoom(id: string) {
    setRoomMsg(null)
    startDelRoomTransition(async () => {
      const result = await deleteRoom(id)
      if (result.error) {
        setRoomMsg({ ok: false, text: result.error })
      } else {
        setRoomMsg({ ok: true, text: 'ルームを削除しました' })
      }
    })
  }

  function handleAddMember() {
    if (!newAccountId.trim() || !newDisplayName.trim()) return
    setMemberMsg(null)
    startMemberTransition(async () => {
      const result = await upsertMember({
        account_id: newAccountId.trim(),
        display_name: newDisplayName.trim(),
        mention_name: newMentionName.trim() || undefined,
      })
      if (result.error) {
        setMemberMsg({ ok: false, text: result.error })
      } else {
        setMemberMsg({ ok: true, text: 'メンバーを追加しました' })
        setNewAccountId('')
        setNewDisplayName('')
        setNewMentionName('')
      }
    })
  }

  function handleDeleteMember(id: string) {
    setMemberMsg(null)
    startDelMemberTransition(async () => {
      const result = await deleteMember(id)
      if (result.error) {
        setMemberMsg({ ok: false, text: result.error })
      } else {
        setMemberMsg({ ok: true, text: 'メンバーを削除しました' })
      }
    })
  }

  function handleStartEditMember(member: CwMember) {
    setEditingMemberId(member.id)
    setEditAccountId(member.account_id)
    setEditDisplayName(member.display_name)
    setEditMentionName(member.mention_name ?? '')
    setMemberMsg(null)
  }

  function handleCancelEditMember() {
    setEditingMemberId(null)
  }

  function handleSaveEditMember(id: string) {
    if (!editAccountId.trim() || !editDisplayName.trim()) return
    setMemberMsg(null)
    startEditMemberTransition(async () => {
      const result = await upsertMember({
        id,
        account_id: editAccountId.trim(),
        display_name: editDisplayName.trim(),
        mention_name: editMentionName.trim() || undefined,
      })
      if (result.error) {
        setMemberMsg({ ok: false, text: result.error })
      } else {
        setMemberMsg({ ok: true, text: '更新しました' })
        setEditingMemberId(null)
      }
    })
  }

  function isRoomMemberLinked(roomDbId: string, memberDbId: string) {
    return roomMembers.some(rm => rm.room_id === roomDbId && rm.member_id === memberDbId)
  }

  function isDefaultMention(roomDbId: string, memberDbId: string) {
    return roomMembers.some(
      rm => rm.room_id === roomDbId && rm.member_id === memberDbId && rm.is_default_mention,
    )
  }

  function handleRoomMemberToggle(roomDbId: string, memberDbId: string, checked: boolean) {
    setRoomMemberMsg(null)
    startRoomMemberTransition(async () => {
      let result: { error?: string }
      if (checked) {
        result = await setRoomMember(roomDbId, memberDbId, false)
      } else {
        result = await removeRoomMember(roomDbId, memberDbId)
      }
      if (result.error) {
        setRoomMemberMsg({ ok: false, text: result.error })
      } else {
        setRoomMemberMsg({ ok: true, text: '更新しました' })
      }
    })
  }

  function handleDefaultMentionToggle(roomDbId: string, memberDbId: string, checked: boolean) {
    setRoomMemberMsg(null)
    startRoomMemberTransition(async () => {
      const result = await setRoomMember(roomDbId, memberDbId, checked)
      if (result.error) {
        setRoomMemberMsg({ ok: false, text: result.error })
      } else {
        setRoomMemberMsg({ ok: true, text: '更新しました' })
      }
    })
  }

  function handleTestSend() {
    if (!testRoomId) return
    setTestMsg(null)
    startTestTransition(async () => {
      try {
        const res = await fetch('/api/chatwork/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_id: testRoomId,
            room_name: rooms.find(r => r.room_id === testRoomId)?.room_name ?? testRoomId,
            message: '[テスト送信] CS Platform からのテストメッセージです。',
            source_type: 'test',
            mentioned_account_ids: [],
            mentioned_names: [],
            comment: '',
            shared_body: '',
            source_url: typeof window !== 'undefined' ? window.location.origin : '',
          }),
        })
        const json = await res.json()
        if (res.ok) {
          setTestMsg({ ok: true, text: 'テスト送信成功しました' })
        } else {
          setTestMsg({ ok: false, text: json.error ?? 'エラーが発生しました' })
        }
      } catch (e) {
        setTestMsg({ ok: false, text: e instanceof Error ? e.message : 'エラーが発生しました' })
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Section 1: APIトークン */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">APIトークン</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">現在のトークン:</span>
            <span className="font-mono text-gray-500">{maskedToken}</span>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiToken}
              onChange={e => setApiToken(e.target.value)}
              placeholder="新しいAPIトークンを入力"
              className="flex-1 border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSaveToken}
              disabled={isPendingToken || !apiToken.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPendingToken ? '保存中...' : '保存'}
            </button>
          </div>
          {tokenMsg && <InlineMessage ok={tokenMsg.ok} message={tokenMsg.text} />}
          <p className="text-xs text-gray-400">
            APIトークンはChatworkのマイページ &gt; API設定から取得できます
          </p>
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* Section 2: ルーム管理 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">ルーム管理</h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {rooms.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">ルームID</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">ルーム名</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">説明</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rooms.map(room => (
                  <tr key={room.id}>
                    <td className="px-4 py-2 text-xs font-mono text-gray-600">{room.room_id}</td>
                    <td className="px-4 py-2 text-xs text-gray-800">{room.room_name}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{room.description ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        disabled={isPendingDelRoom}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-gray-400 p-4">ルームが登録されていません</p>
          )}
          <div className="border-t border-gray-200 p-4 space-y-2">
            <p className="text-xs font-medium text-gray-600 mb-2">ルームを追加</p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={newRoomId}
                onChange={e => setNewRoomId(e.target.value)}
                placeholder="ルームID（数字）"
                className="border border-gray-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
              />
              <input
                type="text"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                placeholder="ルーム名"
                className="border border-gray-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-32"
              />
              <input
                type="text"
                value={newRoomDesc}
                onChange={e => setNewRoomDesc(e.target.value)}
                placeholder="説明（任意）"
                className="border border-gray-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-32"
              />
              <button
                onClick={handleAddRoom}
                disabled={isPendingRoom || !newRoomId.trim() || !newRoomName.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPendingRoom ? '追加中...' : '追加'}
              </button>
            </div>
            {roomMsg && <InlineMessage ok={roomMsg.ok} message={roomMsg.text} />}
          </div>
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* Section 3: メンバー管理 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">メンバー管理</h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {members.length > 0 ? (
            <div className="overflow-y-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">アカウントID</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">表示名</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">備考</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.map(member => {
                    const isEditing = editingMemberId === member.id
                    return (
                      <tr key={member.id} className={isEditing ? 'bg-blue-50' : ''}>
                        {isEditing ? (
                          <>
                            <td className="px-2 py-1.5">
                              <input
                                value={editAccountId}
                                onChange={e => setEditAccountId(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                value={editDisplayName}
                                onChange={e => setEditDisplayName(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                value={editMentionName}
                                onChange={e => setEditMentionName(e.target.value)}
                                placeholder="備考（任意）"
                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleSaveEditMember(member.id)}
                                disabled={isPendingEditMember || !editAccountId.trim() || !editDisplayName.trim()}
                                className="text-xs text-white bg-blue-600 rounded px-2 py-0.5 mr-1 hover:bg-blue-700 disabled:opacity-50"
                              >
                                {isPendingEditMember ? '...' : '保存'}
                              </button>
                              <button
                                onClick={handleCancelEditMember}
                                disabled={isPendingEditMember}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                キャンセル
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2 text-xs font-mono text-gray-600">{member.account_id}</td>
                            <td className="px-4 py-2 text-xs text-gray-800">{member.display_name}</td>
                            <td className="px-4 py-2 text-xs text-gray-500">{member.mention_name ?? '—'}</td>
                            <td className="px-4 py-2 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleStartEditMember(member)}
                                disabled={isPendingDelMember || !!editingMemberId}
                                className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50 mr-3"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDeleteMember(member.id)}
                                disabled={isPendingDelMember || !!editingMemberId}
                                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                              >
                                削除
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400 p-4">メンバーが登録されていません</p>
          )}
          <div className="border-t border-gray-200 p-4 space-y-2">
            <p className="text-xs font-medium text-gray-600 mb-2">メンバーを追加</p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={newAccountId}
                onChange={e => setNewAccountId(e.target.value)}
                placeholder="アカウントID（数字）"
                className="border border-gray-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
              />
              <input
                type="text"
                value={newDisplayName}
                onChange={e => setNewDisplayName(e.target.value)}
                placeholder="表示名"
                className="border border-gray-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-32"
              />
              <input
                type="text"
                value={newMentionName}
                onChange={e => setNewMentionName(e.target.value)}
                placeholder="備考（任意）"
                className="border border-gray-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-32"
              />
              <button
                onClick={handleAddMember}
                disabled={isPendingMember || !newAccountId.trim() || !newDisplayName.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPendingMember ? '追加中...' : '追加'}
              </button>
            </div>
            {memberMsg && <InlineMessage ok={memberMsg.ok} message={memberMsg.text} />}
            <p className="text-xs text-gray-400">
              アカウントIDは<span className="font-semibold text-gray-600">数値のみ</span>（例: 4629051）。Chatwork API <code className="bg-gray-100 px-1 rounded">GET /v2/me</code> の <code className="bg-gray-100 px-1 rounded">account_id</code> フィールドで確認できます。アルファベット混じりのものは無効です。
            </p>
          </div>
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* Section 4: ルームとメンバーの紐付け */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">ルームとメンバーの紐付け</h2>
        {rooms.length === 0 || members.length === 0 ? (
          <p className="text-xs text-gray-400">ルームとメンバーを先に登録してください</p>
        ) : (
          <div className="space-y-4">
            {rooms.map(room => (
              <div key={room.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-800 mb-3">{room.room_name}</p>
                <div className="space-y-2">
                  {members.map(member => {
                    const linked = isRoomMemberLinked(room.id, member.id)
                    const defaultMention = isDefaultMention(room.id, member.id)
                    return (
                      <div key={member.id} className="flex items-center gap-4 text-xs text-gray-700">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={linked}
                            disabled={isPendingRoomMember}
                            onChange={e => handleRoomMemberToggle(room.id, member.id, e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <span>{member.display_name}</span>
                        </label>
                        {linked && (
                          <label className="flex items-center gap-1.5 cursor-pointer text-gray-500">
                            <input
                              type="checkbox"
                              checked={defaultMention}
                              disabled={isPendingRoomMember}
                              onChange={e => handleDefaultMentionToggle(room.id, member.id, e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <span>デフォルトメンション</span>
                          </label>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {roomMemberMsg && <InlineMessage ok={roomMemberMsg.ok} message={roomMemberMsg.text} />}
          </div>
        )}
      </section>

      <hr className="border-gray-200" />

      {/* Section 5: テスト送信 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">テスト送信</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          {rooms.length === 0 ? (
            <p className="text-xs text-gray-400">ルームを先に登録してください</p>
          ) : (
            <>
              <div className="flex gap-2 items-center">
                <select
                  value={testRoomId}
                  onChange={e => setTestRoomId(e.target.value)}
                  className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {rooms.map(room => (
                    <option key={room.id} value={room.room_id}>{room.room_name}</option>
                  ))}
                </select>
                <button
                  onClick={handleTestSend}
                  disabled={isPendingTest || !testRoomId}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPendingTest ? '送信中...' : 'テスト送信'}
                </button>
              </div>
              {testMsg && <InlineMessage ok={testMsg.ok} message={testMsg.text} />}
            </>
          )}
        </div>
      </section>
    </div>
  )
}

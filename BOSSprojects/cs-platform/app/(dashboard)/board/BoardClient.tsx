'use client'

import { useState, useTransition } from 'react'
import {
  type BoardItem,
  type BoardCheck,
  type BoardMember,
  fetchBoardItemsAndChecks,
  addBoardItem,
  updateBoardItem,
  deleteBoardItem,
  setBoardCheck,
} from './actions'

type Form = { date: string; title: string; content: string }

const freshForm = (): Form => ({
  date: new Date().toISOString().slice(0, 10),
  title: '',
  content: '',
})

const inputCls =
  'w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white resize-none'

interface Props {
  initialItems: BoardItem[]
  initialChecks: BoardCheck[]
  members: BoardMember[]
  currentUserId: string
}

export function BoardClient({ initialItems, initialChecks, members, currentUserId }: Props) {
  const [items, setItems] = useState(initialItems)
  const [checks, setChecks] = useState(initialChecks)
  const [isPending, startTransition] = useTransition()

  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState<Form>(freshForm())
  const [addError, setAddError] = useState<string | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Form>(freshForm())
  const [editError, setEditError] = useState<string | null>(null)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function reload() {
    const data = await fetchBoardItemsAndChecks()
    setItems(data.items)
    setChecks(data.checks)
  }

  function handleAdd() {
    if (!addForm.title.trim()) return
    setAddError(null)
    startTransition(async () => {
      try {
        const res = await addBoardItem(addForm.date, addForm.title.trim(), addForm.content || null)
        if (res?.error) { setAddError(res.error); return }
        setAdding(false)
        setAddForm(freshForm())
        await reload()
      } catch (e) {
        setAddError(e instanceof Error ? e.message : '追加に失敗しました')
      }
    })
  }

  function handleSaveEdit() {
    if (!editId || !editForm.title.trim()) return
    setEditError(null)
    startTransition(async () => {
      try {
        const res = await updateBoardItem(editId, editForm.date, editForm.title.trim(), editForm.content || null)
        if (res?.error) { setEditError(res.error); return }
        setEditId(null)
        await reload()
      } catch (e) {
        setEditError(e instanceof Error ? e.message : '保存に失敗しました')
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteBoardItem(id)
      setConfirmDeleteId(null)
      await reload()
    })
  }

  function handleCheck(itemId: string, isChecked: boolean) {
    startTransition(async () => {
      await setBoardCheck(itemId, currentUserId, !isChecked)
      await reload()
    })
  }

  function startEdit(item: BoardItem) {
    setEditId(item.id)
    setEditForm({ date: item.date, title: item.title, content: item.content ?? '' })
    setEditError(null)
    setConfirmDeleteId(null)
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const colSpan = 3 + members.length + 1

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-semibold text-gray-800">共有ボード</h1>
        {!adding && (
          <button
            onClick={() => { setAdding(true); setAddForm(freshForm()); setAddError(null); setEditId(null) }}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            + 追加
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 w-16">日付</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 w-44">項目名</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">詳細</th>
                {members.map((m) => (
                  <th
                    key={m.id}
                    title={m.display_name}
                    className="px-2 py-2.5 text-xs font-semibold text-gray-600 w-10 text-center"
                  >
                    {m.display_name.charAt(0)}
                  </th>
                ))}
                <th className="px-3 py-2.5 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Add form row */}
              {adding && (
                <tr className="bg-blue-50">
                  <td colSpan={colSpan} className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 items-start">
                      <input
                        type="date" value={addForm.date}
                        onChange={(e) => setAddForm((p) => ({ ...p, date: e.target.value }))}
                        className="text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white w-36"
                      />
                      <input
                        type="text" value={addForm.title} autoFocus
                        onChange={(e) => setAddForm((p) => ({ ...p, title: e.target.value }))}
                        placeholder="項目名 *"
                        className="text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white w-44"
                      />
                      <textarea
                        value={addForm.content} rows={2}
                        onChange={(e) => setAddForm((p) => ({ ...p, content: e.target.value }))}
                        placeholder={'詳細（任意）\nEnterで改行'}
                        className="text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white flex-1 min-w-48 resize-none"
                      />
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={handleAdd}
                          disabled={isPending || !addForm.title.trim()}
                          className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {isPending ? '...' : '追加'}
                        </button>
                        <button
                          onClick={() => { setAdding(false); setAddError(null) }}
                          className="text-sm px-3 py-1.5 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {addError && <p className="text-xs text-red-600 mt-1">{addError}</p>}
                  </td>
                </tr>
              )}

              {/* Empty state */}
              {items.length === 0 && !adding && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-sm text-gray-400 text-center italic">
                    投稿がありません
                  </td>
                </tr>
              )}

              {/* Item rows */}
              {items.map((item) => {
                const itemChecks = checks.filter((c) => c.item_id === item.id)
                const myCheck = itemChecks.some((c) => c.user_id === currentUserId)

                if (editId === item.id) {
                  return (
                    <tr key={item.id} className="bg-gray-50">
                      <td colSpan={colSpan} className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 items-start">
                          <input
                            type="date" value={editForm.date}
                            onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                            className="text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white w-36"
                          />
                          <input
                            type="text" value={editForm.title} autoFocus
                            onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                            placeholder="項目名 *"
                            className="text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white w-44"
                          />
                          <textarea
                            value={editForm.content} rows={2}
                            onChange={(e) => setEditForm((p) => ({ ...p, content: e.target.value }))}
                            placeholder={'詳細（任意）\nEnterで改行'}
                            className="text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white flex-1 min-w-48 resize-none"
                          />
                          <div className="flex gap-2 items-center">
                            <button
                              onClick={handleSaveEdit}
                              disabled={isPending || !editForm.title.trim()}
                              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {isPending ? '...' : '保存'}
                            </button>
                            <button
                              onClick={() => { setEditId(null); setEditError(null) }}
                              className="text-sm px-3 py-1.5 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        {editError && <p className="text-xs text-red-600 mt-1">{editError}</p>}
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 text-xs text-gray-500 tabular-nums whitespace-nowrap align-top">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-800 align-top">
                      {item.title}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed align-top">
                      {item.content}
                    </td>
                    {members.map((member) => {
                      const isChecked = itemChecks.some((c) => c.user_id === member.id)
                      const isMe = member.id === currentUserId
                      return (
                        <td key={member.id} className="px-2 py-3 text-center align-top">
                          <button
                            onClick={() => isMe ? handleCheck(item.id, isChecked) : undefined}
                            disabled={!isMe || isPending}
                            title={`${member.display_name}${isChecked ? ' ✓' : ''}`}
                            className={`w-7 h-7 rounded-full text-xs font-semibold transition-colors flex items-center justify-center mx-auto
                              ${isChecked ? 'bg-blue-500 text-white' : 'border border-gray-300 text-gray-400 bg-white'}
                              ${isMe ? 'cursor-pointer hover:opacity-70' : 'cursor-default'}
                            `}
                          >
                            {member.display_name.charAt(0)}
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-3 py-3 text-right align-top whitespace-nowrap">
                      {confirmDeleteId === item.id ? (
                        <span className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={isPending}
                            className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            削除
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            ×
                          </button>
                        </span>
                      ) : (
                        <span className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => startEdit(item)}
                            className="text-xs px-2 py-1 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="text-xs px-2 py-1 border border-red-200 text-red-400 rounded hover:bg-red-50 transition-colors"
                          >
                            削除
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

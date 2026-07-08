'use client'

import { useState, useTransition } from 'react'
import {
  type ChecklistItem,
  fetchChecklistItems,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from './master/checklist/actions'

type ItemForm = { title: string; content: string; url: string }
const emptyForm: ItemForm = { title: '', content: '', url: '' }

export function ChecklistDrawer({ initialItems }: { initialItems: ChecklistItem[] }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ChecklistItem[]>(initialItems)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ItemForm>(emptyForm)
  const [addingSection, setAddingSection] = useState<'pre' | 'post' | null>(null)
  const [addForm, setAddForm] = useState<ItemForm>(emptyForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function reload() {
    const data = await fetchChecklistItems()
    setItems(data)
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSaveEdit() {
    if (!editingId || !editForm.title.trim()) return
    startTransition(async () => {
      await updateChecklistItem(editingId, editForm.title.trim(), editForm.content || null, editForm.url || null)
      setEditingId(null)
      await reload()
    })
  }

  function handleAdd() {
    if (!addingSection || !addForm.title.trim()) return
    const order = items.filter((i) => i.section === addingSection).length
    startTransition(async () => {
      await addChecklistItem(addingSection, addForm.title.trim(), addForm.content || null, addForm.url || null, order)
      setAddingSection(null)
      setAddForm(emptyForm)
      await reload()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteChecklistItem(id)
      setConfirmDeleteId(null)
      await reload()
    })
  }

  function startEdit(item: ChecklistItem) {
    setEditingId(item.id)
    setEditForm({ title: item.title, content: item.content ?? '', url: item.url ?? '' })
    setConfirmDeleteId(null)
  }

  function startAdd(section: 'pre' | 'post') {
    setAddingSection(section)
    setAddForm(emptyForm)
    setEditingId(null)
  }

  const preItems = items.filter((i) => i.section === 'pre')
  const postItems = items.filter((i) => i.section === 'post')
  const totalChecked = items.filter((i) => checked.has(i.id)).length
  const allDone = items.length > 0 && totalChecked === items.length

  function renderSection(section: 'pre' | 'post', label: string, sectionItems: ChecklistItem[]) {
    const done = sectionItems.filter((i) => checked.has(i.id)).length
    const total = sectionItems.length
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-700">{label}</span>
          {total > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              done === total ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {done}/{total}
            </span>
          )}
        </div>
        <div className="divide-y divide-gray-50">
          {sectionItems.length === 0 && addingSection !== section && (
            <p className="text-xs text-gray-400 px-3 py-3 italic">項目がありません</p>
          )}

          {sectionItems.map((item) => (
            <div key={item.id} className="px-3 py-2.5">
              {editingId === item.id ? (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="項目名"
                    autoFocus
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={editForm.content}
                    onChange={(e) => setEditForm((p) => ({ ...p, content: e.target.value }))}
                    placeholder="内容（任意）"
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="url"
                    value={editForm.url}
                    onChange={(e) => setEditForm((p) => ({ ...p, url: e.target.value }))}
                    placeholder="URL（任意）"
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      onClick={handleSaveEdit}
                      disabled={isPending || !editForm.title.trim()}
                      className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isPending ? '...' : '保存'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs px-2.5 py-1 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={checked.has(item.id)}
                    onChange={() => toggleCheck(item.id)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 accent-blue-600 cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-snug ${
                      checked.has(item.id) ? 'line-through text-gray-400' : 'text-gray-800'
                    }`}>
                      {item.title}
                    </p>
                    {item.content && (
                      <p className={`text-xs mt-0.5 ${
                        checked.has(item.id) ? 'text-gray-300' : 'text-gray-400'
                      }`}>
                        {item.content}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-600 transition-colors"
                        title="開く"
                      >
                        ↗
                      </a>
                    )}
                    {confirmDeleteId === item.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={isPending}
                          className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                        >
                          削除
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(item)}
                          className="text-xs text-gray-300 hover:text-gray-600 transition-colors"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="text-xs text-red-300 hover:text-red-500 transition-colors"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {addingSection === section && (
            <div className="px-3 py-2.5 bg-blue-50 space-y-1.5">
              <input
                type="text"
                value={addForm.title}
                onChange={(e) => setAddForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="項目名 *"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
              <input
                type="text"
                value={addForm.content}
                onChange={(e) => setAddForm((p) => ({ ...p, content: e.target.value }))}
                placeholder="内容（任意）"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
              <input
                type="url"
                value={addForm.url}
                onChange={(e) => setAddForm((p) => ({ ...p, url: e.target.value }))}
                placeholder="URL（任意）"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
              <div className="flex gap-1.5 pt-0.5">
                <button
                  onClick={handleAdd}
                  disabled={isPending || !addForm.title.trim()}
                  className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? '...' : '追加'}
                </button>
                <button
                  onClick={() => setAddingSection(null)}
                  className="text-xs px-2.5 py-1 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {addingSection !== section && (
            <button
              onClick={() => startAdd(section)}
              className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              + 項目を追加
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative text-sm px-2.5 py-1 rounded-md transition-colors ${
          open
            ? 'bg-gray-100 text-gray-900 font-medium'
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
        }`}
      >
        チェック
        {totalChecked > 0 && !allDone && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" />
        )}
        {allDone && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full" />
        )}
      </button>

      {open && (
        <>
          {/* Backdrop (below header) */}
          <div
            className="fixed inset-x-0 top-12 bottom-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
          />

          {/* Drawer panel */}
          <div className="fixed right-0 top-12 z-50 h-[calc(100vh-3rem)] w-72 bg-white shadow-xl border-l border-gray-200 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-800">稼働チェックリスト</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none transition-colors"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {renderSection('pre', '稼働開始前', preItems)}
              {renderSection('post', '稼働終了後', postItems)}
              <p className="text-xs text-gray-300 text-center pb-2">
                チェックは閉じるとリセットされます
              </p>
            </div>
          </div>
        </>
      )}
    </>
  )
}

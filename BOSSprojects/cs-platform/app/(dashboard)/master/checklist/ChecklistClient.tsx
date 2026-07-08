'use client'

import { useState, useTransition } from 'react'
import { addChecklistItem, updateChecklistItem, deleteChecklistItem } from './actions'
import { emitToast } from '@/components/ui/toast-emitter'

export type ChecklistItem = {
  id: string
  section: 'pre' | 'post'
  title: string
  content: string | null
  url: string | null
  display_order: number
}

type ItemForm = { title: string; content: string; url: string }

const emptyForm: ItemForm = { title: '', content: '', url: '' }

function itemToForm(item: ChecklistItem): ItemForm {
  return { title: item.title, content: item.content ?? '', url: item.url ?? '' }
}

export function ChecklistClient({ initialItems }: { initialItems: ChecklistItem[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ItemForm>(emptyForm)
  const [addingSection, setAddingSection] = useState<'pre' | 'post' | null>(null)
  const [addForm, setAddForm] = useState<ItemForm>(emptyForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const preItems = initialItems.filter((i) => i.section === 'pre')
  const postItems = initialItems.filter((i) => i.section === 'post')

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function startEdit(item: ChecklistItem) {
    setEditingId(item.id)
    setEditForm(itemToForm(item))
    setConfirmDeleteId(null)
  }

  function handleSaveEdit() {
    if (!editingId || !editForm.title.trim()) return
    startTransition(async () => {
      const result = await updateChecklistItem(
        editingId,
        editForm.title.trim(),
        editForm.content || null,
        editForm.url || null,
      )
      if (result.error) emitToast(result.error, 'error')
      else { emitToast('更新しました'); setEditingId(null) }
    })
  }

  function startAdd(section: 'pre' | 'post') {
    setAddingSection(section)
    setAddForm(emptyForm)
    setEditingId(null)
  }

  function handleAdd() {
    if (!addingSection || !addForm.title.trim()) return
    const order = initialItems.filter((i) => i.section === addingSection).length
    startTransition(async () => {
      const result = await addChecklistItem(
        addingSection,
        addForm.title.trim(),
        addForm.content || null,
        addForm.url || null,
        order,
      )
      if (result.error) emitToast(result.error, 'error')
      else { emitToast('追加しました'); setAddingSection(null); setAddForm(emptyForm) }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteChecklistItem(id)
      setConfirmDeleteId(null)
      if (result.error) emitToast(result.error, 'error')
      else emitToast('削除しました')
    })
  }

  const allInSection = (section: 'pre' | 'post') =>
    initialItems.filter((i) => i.section === section)

  const doneCount = (section: 'pre' | 'post') =>
    allInSection(section).filter((i) => checked.has(i.id)).length

  return (
    <div className="space-y-6 max-w-2xl">
      {(['pre', 'post'] as const).map((section) => {
        const label = section === 'pre' ? '稼働開始前' : '稼働終了後'
        const items = section === 'pre' ? preItems : postItems
        const total = items.length
        const done = doneCount(section)

        return (
          <div key={section} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-700">{label}</h2>
                {total > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    done === total
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {done}/{total}
                  </span>
                )}
              </div>
              {done === total && total > 0 && (
                <span className="text-xs text-green-600 font-medium">✓ 完了</span>
              )}
            </div>

            {/* Items */}
            <div className="divide-y divide-gray-100">
              {items.length === 0 && addingSection !== section && (
                <p className="text-xs text-gray-400 px-4 py-4 italic">項目がありません</p>
              )}

              {items.map((item) => (
                <div key={item.id} className="px-4 py-3">
                  {editingId === item.id ? (
                    /* Edit mode */
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                        placeholder="項目名"
                        autoFocus
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={editForm.content}
                        onChange={(e) => setEditForm((p) => ({ ...p, content: e.target.value }))}
                        placeholder="内容・説明（任意）"
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="url"
                        value={editForm.url}
                        onChange={(e) => setEditForm((p) => ({ ...p, url: e.target.value }))}
                        placeholder="リンクURL（任意）"
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleSaveEdit}
                          disabled={isPending || !editForm.title.trim()}
                          className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {isPending ? '保存中...' : '保存'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs px-3 py-1 border border-gray-200 text-gray-500 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display mode */
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked.has(item.id)}
                        onChange={() => toggleCheck(item.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer flex-shrink-0 accent-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-snug ${
                          checked.has(item.id) ? 'line-through text-gray-400' : 'text-gray-800'
                        }`}>
                          {item.title}
                        </p>
                        {item.content && (
                          <p className={`text-xs mt-0.5 leading-relaxed ${
                            checked.has(item.id) ? 'text-gray-300' : 'text-gray-500'
                          }`}>
                            {item.content}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded px-1.5 py-0.5 transition-colors"
                          >
                            開く↗
                          </a>
                        )}
                        {confirmDeleteId === item.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={isPending}
                              className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              削除
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs px-2 py-0.5 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 transition-colors"
                            >
                              ×
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(item)}
                              className="text-xs px-2 py-0.5 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 transition-colors"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="text-xs px-2 py-0.5 border border-red-200 text-red-400 rounded hover:bg-red-50 transition-colors"
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

              {/* Add form */}
              {addingSection === section && (
                <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 space-y-2">
                  <input
                    type="text"
                    value={addForm.title}
                    onChange={(e) => setAddForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="項目名 *"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <input
                    type="text"
                    value={addForm.content}
                    onChange={(e) => setAddForm((p) => ({ ...p, content: e.target.value }))}
                    placeholder="内容・説明（任意）"
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <input
                    type="url"
                    value={addForm.url}
                    onChange={(e) => setAddForm((p) => ({ ...p, url: e.target.value }))}
                    placeholder="リンクURL（任意）"
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleAdd}
                      disabled={isPending || !addForm.title.trim()}
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isPending ? '追加中...' : '追加'}
                    </button>
                    <button
                      onClick={() => setAddingSection(null)}
                      className="text-xs px-3 py-1 border border-gray-200 text-gray-500 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {/* Add button */}
              {addingSection !== section && (
                <button
                  onClick={() => startAdd(section)}
                  className="w-full text-left px-4 py-2.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  + 項目を追加
                </button>
              )}
            </div>
          </div>
        )
      })}

      <p className="text-xs text-gray-400">チェック状態はページを離れるとリセットされます</p>
    </div>
  )
}

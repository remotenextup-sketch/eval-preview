'use client'

import { useState, useTransition } from 'react'
import {
  type ChecklistItem,
  fetchChecklistItems,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from './master/checklist/actions'
import {
  type BoardItem,
  type BoardCheck,
  type BoardMember,
  fetchBoardItemsAndChecks,
  addBoardItem,
  updateBoardItem,
  deleteBoardItem,
  setBoardCheck,
} from './board/actions'

type Tab = 'checklist' | 'board'
type CForm = { title: string; content: string; url: string }
type BForm = { date: string; title: string; content: string }

const emptyCForm: CForm = { title: '', content: '', url: '' }
const freshBForm = (): BForm => ({
  date: new Date().toISOString().slice(0, 10),
  title: '',
  content: '',
})

const inputCls =
  'w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white resize-none'

interface Props {
  initialChecklistItems: ChecklistItem[]
  initialBoardItems: BoardItem[]
  initialBoardChecks: BoardCheck[]
  boardMembers: BoardMember[]
  currentUserId: string | null
}

export function HeaderPanel({
  initialChecklistItems,
  initialBoardItems,
  initialBoardChecks,
  boardMembers,
  currentUserId,
}: Props) {
  const [tab, setTab] = useState<Tab | null>(null)
  const [isPending, startTransition] = useTransition()

  // ── Checklist state ──
  const [clItems, setClItems] = useState(initialChecklistItems)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [clEditId, setClEditId] = useState<string | null>(null)
  const [clEditForm, setClEditForm] = useState<CForm>(emptyCForm)
  const [clEditErr, setClEditErr] = useState<string | null>(null)
  const [clAddSection, setClAddSection] = useState<'pre' | 'post' | null>(null)
  const [clAddForm, setClAddForm] = useState<CForm>(emptyCForm)
  const [clAddErr, setClAddErr] = useState<string | null>(null)
  const [clDelId, setClDelId] = useState<string | null>(null)

  // ── Board state ──
  const [bItems, setBItems] = useState(initialBoardItems)
  const [bChecks, setBChecks] = useState(initialBoardChecks)
  const [bEditId, setBEditId] = useState<string | null>(null)
  const [bEditForm, setBEditForm] = useState<BForm>(freshBForm())
  const [bEditErr, setBEditErr] = useState<string | null>(null)
  const [bAdding, setBAdding] = useState(false)
  const [bAddForm, setBAddForm] = useState<BForm>(freshBForm())
  const [bAddErr, setBAddErr] = useState<string | null>(null)
  const [bDelId, setBDelId] = useState<string | null>(null)

  function openTab(t: Tab) {
    setTab((prev) => (prev === t ? null : t))
  }

  // ── Checklist reload ──
  async function reloadChecklist() {
    const data = await fetchChecklistItems()
    setClItems(data)
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleClSaveEdit() {
    if (!clEditId || !clEditForm.title.trim()) return
    setClEditErr(null)
    startTransition(async () => {
      try {
        const res = await updateChecklistItem(
          clEditId, clEditForm.title.trim(), clEditForm.content || null, clEditForm.url || null,
        )
        if (res?.error) { setClEditErr(res.error); return }
        setClEditId(null)
        await reloadChecklist()
      } catch (e) {
        setClEditErr(e instanceof Error ? e.message : '保存に失敗しました')
      }
    })
  }

  function handleClAdd() {
    if (!clAddSection || !clAddForm.title.trim()) return
    setClAddErr(null)
    const order = clItems.filter((i) => i.section === clAddSection).length
    startTransition(async () => {
      try {
        const res = await addChecklistItem(
          clAddSection, clAddForm.title.trim(), clAddForm.content || null, clAddForm.url || null, order,
        )
        if (res?.error) { setClAddErr(res.error); return }
        setClAddSection(null)
        setClAddForm(emptyCForm)
        await reloadChecklist()
      } catch (e) {
        setClAddErr(e instanceof Error ? e.message : '追加に失敗しました')
      }
    })
  }

  function handleClDelete(id: string) {
    startTransition(async () => {
      await deleteChecklistItem(id)
      setClDelId(null)
      await reloadChecklist()
    })
  }

  // ── Board reload ──
  async function reloadBoard() {
    const data = await fetchBoardItemsAndChecks()
    setBItems(data.items)
    setBChecks(data.checks)
  }

  function handleBoardCheck(itemId: string, isChecked: boolean) {
    if (!currentUserId) return
    startTransition(async () => {
      await setBoardCheck(itemId, currentUserId, !isChecked)
      await reloadBoard()
    })
  }

  function handleBAdd() {
    if (!bAddForm.title.trim()) return
    setBAddErr(null)
    startTransition(async () => {
      try {
        const res = await addBoardItem(bAddForm.date, bAddForm.title.trim(), bAddForm.content || null)
        if (res?.error) { setBAddErr(res.error); return }
        setBAdding(false)
        setBAddForm(freshBForm())
        await reloadBoard()
      } catch (e) {
        setBAddErr(e instanceof Error ? e.message : '追加に失敗しました')
      }
    })
  }

  function handleBSaveEdit() {
    if (!bEditId || !bEditForm.title.trim()) return
    setBEditErr(null)
    startTransition(async () => {
      try {
        const res = await updateBoardItem(bEditId, bEditForm.date, bEditForm.title.trim(), bEditForm.content || null)
        if (res?.error) { setBEditErr(res.error); return }
        setBEditId(null)
        await reloadBoard()
      } catch (e) {
        setBEditErr(e instanceof Error ? e.message : '保存に失敗しました')
      }
    })
  }

  function handleBDelete(id: string) {
    startTransition(async () => {
      await deleteBoardItem(id)
      setBDelId(null)
      await reloadBoard()
    })
  }

  // ── Derived ──
  const preItems = clItems.filter((i) => i.section === 'pre')
  const postItems = clItems.filter((i) => i.section === 'post')
  const clTotalChecked = clItems.filter((i) => checked.has(i.id)).length
  const clAllDone = clItems.length > 0 && clTotalChecked === clItems.length
  const clInProgress = clTotalChecked > 0 && !clAllDone

  const unreadBoard = currentUserId
    ? bItems.filter((it) => !bChecks.some((c) => c.item_id === it.id && c.user_id === currentUserId)).length
    : 0

  // ── Checklist section renderer ──
  function renderClSection(section: 'pre' | 'post', label: string, sectionItems: ChecklistItem[]) {
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
          {sectionItems.length === 0 && clAddSection !== section && (
            <p className="text-xs text-gray-400 px-3 py-3 italic">項目がありません</p>
          )}
          {sectionItems.map((item) => (
            <div key={item.id} className="px-3 py-2.5">
              {clEditId === item.id ? (
                <div className="space-y-1.5">
                  <input
                    type="text" value={clEditForm.title} autoFocus
                    onChange={(e) => setClEditForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="項目名" className={inputCls}
                  />
                  <textarea
                    value={clEditForm.content} rows={3}
                    onChange={(e) => setClEditForm((p) => ({ ...p, content: e.target.value }))}
                    placeholder={'内容（任意）\nEnterで改行'} className={inputCls}
                  />
                  <input
                    type="url" value={clEditForm.url}
                    onChange={(e) => setClEditForm((p) => ({ ...p, url: e.target.value }))}
                    placeholder="URL（任意）" className={inputCls}
                  />
                  {clEditErr && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{clEditErr}</p>}
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      onClick={handleClSaveEdit}
                      disabled={isPending || !clEditForm.title.trim()}
                      className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isPending ? '...' : '保存'}
                    </button>
                    <button
                      onClick={() => { setClEditId(null); setClEditErr(null) }}
                      className="text-xs px-2.5 py-1 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox" checked={checked.has(item.id)}
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
                      <p className={`text-xs mt-0.5 whitespace-pre-wrap leading-relaxed ${
                        checked.has(item.id) ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        {item.content}
                      </p>
                    )}
                    {item.url && (
                      <a
                        href={item.url} target="_blank" rel="noopener noreferrer"
                        className={`text-xs mt-1 block break-all hover:underline ${
                          checked.has(item.id) ? 'text-gray-300' : 'text-blue-500'
                        }`}
                      >
                        {item.url}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                    {clDelId === item.id ? (
                      <>
                        <button
                          onClick={() => handleClDelete(item.id)} disabled={isPending}
                          className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                        >
                          削除
                        </button>
                        <button
                          onClick={() => setClDelId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setClEditId(item.id)
                            setClEditForm({ title: item.title, content: item.content ?? '', url: item.url ?? '' })
                            setClEditErr(null)
                            setClDelId(null)
                          }}
                          className="text-xs text-gray-300 hover:text-gray-600 transition-colors"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => setClDelId(item.id)}
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
          {clAddSection === section && (
            <div className="px-3 py-2.5 bg-blue-50 space-y-1.5">
              <input
                type="text" value={clAddForm.title} autoFocus
                onChange={(e) => setClAddForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="項目名 *" className={inputCls}
              />
              <textarea
                value={clAddForm.content} rows={3}
                onChange={(e) => setClAddForm((p) => ({ ...p, content: e.target.value }))}
                placeholder={'内容（任意）\nEnterで改行'} className={inputCls}
              />
              <input
                type="url" value={clAddForm.url}
                onChange={(e) => setClAddForm((p) => ({ ...p, url: e.target.value }))}
                placeholder="URL（任意）" className={inputCls}
              />
              {clAddErr && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{clAddErr}</p>}
              <div className="flex gap-1.5 pt-0.5">
                <button
                  onClick={handleClAdd}
                  disabled={isPending || !clAddForm.title.trim()}
                  className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? '...' : '追加'}
                </button>
                <button
                  onClick={() => { setClAddSection(null); setClAddErr(null) }}
                  className="text-xs px-2.5 py-1 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
          )}
          {clAddSection !== section && (
            <button
              onClick={() => {
                setClAddSection(section)
                setClAddForm(emptyCForm)
                setClAddErr(null)
                setClEditId(null)
              }}
              className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              + 項目を追加
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Board renderer ──
  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  function renderBoard() {
    return (
      <div className="space-y-3">
        {!bAdding && (
          <button
            onClick={() => { setBAdding(true); setBAddForm(freshBForm()); setBAddErr(null); setBEditId(null) }}
            className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 border border-dashed border-gray-200 rounded-lg transition-colors"
          >
            + 追加
          </button>
        )}

        {bAdding && (
          <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-1.5">
            <input
              type="date" value={bAddForm.date}
              onChange={(e) => setBAddForm((p) => ({ ...p, date: e.target.value }))}
              className={inputCls}
            />
            <input
              type="text" value={bAddForm.title} autoFocus
              onChange={(e) => setBAddForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="項目名 *" className={inputCls}
            />
            <textarea
              value={bAddForm.content} rows={3}
              onChange={(e) => setBAddForm((p) => ({ ...p, content: e.target.value }))}
              placeholder={'詳細（任意）\nEnterで改行'} className={inputCls}
            />
            {bAddErr && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{bAddErr}</p>}
            <div className="flex gap-1.5 pt-0.5">
              <button
                onClick={handleBAdd}
                disabled={isPending || !bAddForm.title.trim()}
                className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? '...' : '追加'}
              </button>
              <button
                onClick={() => { setBAdding(false); setBAddErr(null) }}
                className="text-xs px-2.5 py-1 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {bItems.length === 0 && !bAdding && (
          <p className="text-xs text-gray-400 text-center py-6 italic">投稿がありません</p>
        )}

        {bItems.map((item) => {
          const itemChecks = bChecks.filter((c) => c.item_id === item.id)
          const myCheck = itemChecks.some((c) => c.user_id === currentUserId)

          return (
            <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {bEditId === item.id ? (
                <div className="p-3 bg-gray-50 space-y-1.5">
                  <input
                    type="date" value={bEditForm.date}
                    onChange={(e) => setBEditForm((p) => ({ ...p, date: e.target.value }))}
                    className={inputCls}
                  />
                  <input
                    type="text" value={bEditForm.title} autoFocus
                    onChange={(e) => setBEditForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="項目名 *" className={inputCls}
                  />
                  <textarea
                    value={bEditForm.content} rows={3}
                    onChange={(e) => setBEditForm((p) => ({ ...p, content: e.target.value }))}
                    placeholder={'詳細（任意）\nEnterで改行'} className={inputCls}
                  />
                  {bEditErr && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{bEditErr}</p>}
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      onClick={handleBSaveEdit}
                      disabled={isPending || !bEditForm.title.trim()}
                      className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isPending ? '...' : '保存'}
                    </button>
                    <button
                      onClick={() => { setBEditId(null); setBEditErr(null) }}
                      className="text-xs px-2.5 py-1 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2 px-3 py-2.5">
                    <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5 tabular-nums">
                      {formatDate(item.date)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 leading-snug">{item.title}</p>
                      {item.content && (
                        <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap leading-relaxed">
                          {item.content}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {bDelId === item.id ? (
                        <>
                          <button
                            onClick={() => handleBDelete(item.id)} disabled={isPending}
                            className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            削除
                          </button>
                          <button
                            onClick={() => setBDelId(null)}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            ×
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setBEditId(item.id)
                              setBEditForm({ date: item.date, title: item.title, content: item.content ?? '' })
                              setBEditErr(null)
                              setBDelId(null)
                            }}
                            className="text-xs text-gray-300 hover:text-gray-600 transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => setBDelId(item.id)}
                            className="text-xs text-red-300 hover:text-red-500 transition-colors"
                          >
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {boardMembers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 px-3 pb-2.5 border-t border-gray-50 pt-1.5">
                      {boardMembers.map((member) => {
                        const isChecked = itemChecks.some((c) => c.user_id === member.id)
                        const isMe = member.id === currentUserId
                        return (
                          <button
                            key={member.id}
                            onClick={() => isMe ? handleBoardCheck(item.id, isChecked) : undefined}
                            disabled={!isMe || isPending}
                            title={`${member.display_name}${isChecked ? ' ✓' : ''}`}
                            className={`w-6 h-6 rounded-full text-[10px] font-semibold transition-colors flex items-center justify-center
                              ${isChecked
                                ? 'bg-blue-500 text-white'
                                : 'border border-gray-300 text-gray-400 bg-white'
                              }
                              ${isMe ? 'cursor-pointer hover:opacity-70' : 'cursor-default'}
                            `}
                          >
                            {member.display_name.charAt(0)}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {/* チェックリスト button */}
      <button
        onClick={() => openTab('checklist')}
        className={`relative text-sm px-2.5 py-1 rounded-md transition-colors ${
          tab === 'checklist'
            ? 'bg-gray-100 text-gray-900 font-medium'
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
        }`}
      >
        チェック
        {clInProgress && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" />}
        {clAllDone && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full" />}
      </button>

      {/* 共有ボード button */}
      <button
        onClick={() => openTab('board')}
        className={`relative text-sm px-2.5 py-1 rounded-md transition-colors ${
          tab === 'board'
            ? 'bg-gray-100 text-gray-900 font-medium'
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
        }`}
      >
        ボード
        {unreadBoard > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-orange-400 text-white rounded-full text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
            {unreadBoard}
          </span>
        )}
      </button>

      {/* Shared drawer */}
      {tab && (
        <>
          <div
            className="fixed inset-x-0 top-12 bottom-0 z-40 bg-black/20"
            onClick={() => setTab(null)}
          />
          <div className="fixed right-0 top-12 z-50 h-[calc(100vh-3rem)] w-80 bg-white shadow-xl border-l border-gray-200 flex flex-col">
            {/* Tab header */}
            <div className="flex items-center border-b border-gray-200 flex-shrink-0">
              <button
                onClick={() => setTab('checklist')}
                className={`text-xs px-4 py-3 border-b-2 -mb-px transition-colors ${
                  tab === 'checklist'
                    ? 'border-blue-500 text-blue-600 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                チェックリスト
              </button>
              <button
                onClick={() => setTab('board')}
                className={`relative text-xs px-4 py-3 border-b-2 -mb-px transition-colors ${
                  tab === 'board'
                    ? 'border-blue-500 text-blue-600 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                共有ボード
                {unreadBoard > 0 && tab !== 'board' && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[14px] h-3.5 bg-orange-400 text-white rounded-full text-[9px] font-bold px-0.5 leading-none">
                    {unreadBoard}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab(null)}
                className="ml-auto px-3 text-gray-400 hover:text-gray-600 text-lg leading-none transition-colors py-3"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {tab === 'checklist' && (
                <>
                  {renderClSection('pre', '稼働開始前', preItems)}
                  {renderClSection('post', '稼働終了後', postItems)}
                  <p className="text-xs text-gray-300 text-center pb-2">
                    チェックは閉じるとリセットされます
                  </p>
                </>
              )}
              {tab === 'board' && renderBoard()}
            </div>
          </div>
        </>
      )}
    </>
  )
}

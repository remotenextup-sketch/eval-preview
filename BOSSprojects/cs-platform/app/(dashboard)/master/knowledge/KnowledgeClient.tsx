'use client'

import { useState, useTransition, useMemo } from 'react'
import { upsertKnowledge, toggleKnowledge } from './actions'
import { emitToast } from '@/components/ui/toast-emitter'

type KnowledgeCase = {
  id: string
  product_name: string | null
  question: string | null
  reply_body: string | null
  reason_category: string | null
  source: string | null
  confidence: number | null
  status: string
  memo: string | null
  updated_at: string | null
}

type FormState = {
  id?: string
  product_name: string
  question: string
  answer: string
  reply_body: string
  reason_category: string
  source: string
  confidence: string
  status: string
  memo: string
}

const REASON_CATEGORIES = [
  { value: '', label: '（選択してください）' },
  { value: 'defective', label: '初期不良' },
  { value: 'damaged', label: '破損・汚損' },
  { value: 'missing_parts', label: '部品欠品' },
  { value: 'wrong_item', label: '商品相違' },
  { value: 'wrong_quantity', label: '数量相違' },
  { value: 'size_mismatch', label: 'サイズ不一致' },
  { value: 'customer_reason', label: 'お客様都合' },
  { value: 'delivery_issue', label: '配送トラブル' },
  { value: 'specification_misunderstanding', label: 'スペック誤認識' },
  { value: 'other', label: 'その他' },
]

const emptyForm: FormState = {
  product_name: '',
  question: '',
  answer: '',
  reply_body: '',
  reason_category: '',
  source: '',
  confidence: '',
  status: 'active',
  memo: '',
}

function caseToForm(c: KnowledgeCase): FormState {
  return {
    id: c.id,
    product_name: c.product_name ?? '',
    question: c.question ?? '',
    answer: '',
    reply_body: c.reply_body ?? '',
    reason_category: c.reason_category ?? '',
    source: c.source ?? '',
    confidence: c.confidence != null ? String(c.confidence) : '',
    status: c.status,
    memo: c.memo ?? '',
  }
}

function truncate(text: string | null, len: number): string {
  if (!text) return '─'
  return text.length > len ? text.slice(0, len) + '...' : text
}

export function KnowledgeClient({ cases }: { cases: KnowledgeCase[] }) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [modalError, setModalError] = useState('')
  const [modalSuccess, setModalSuccess] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        (c.product_name ?? '').toLowerCase().includes(q) ||
        (c.question ?? '').toLowerCase().includes(q) ||
        (c.reply_body ?? '').toLowerCase().includes(q)
      const matchStatus = !filterStatus || c.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [cases, search, filterStatus])

  function openAdd() {
    setForm(emptyForm)
    setModalError('')
    setModalSuccess('')
    setIsModalOpen(true)
  }

  function openEdit(c: KnowledgeCase) {
    setForm(caseToForm(c))
    setModalError('')
    setModalSuccess('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setModalError('')
    setModalSuccess('')
  }

  function handleToggle(c: KnowledgeCase) {
    startTransition(async () => {
      const newStatus = c.status === 'active' ? 'inactive' : 'active'
      const result = await toggleKnowledge(c.id, newStatus)
      if (result.error) emitToast(result.error, 'error')
      else emitToast(newStatus === 'active' ? '有効化しました' : '無効化しました')
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setModalError('')
    setModalSuccess('')

    startTransition(async () => {
      const result = await upsertKnowledge({
        id: form.id,
        product_name: form.product_name || undefined,
        question: form.question || undefined,
        answer: form.answer || undefined,
        reply_body: form.reply_body || undefined,
        reason_category: form.reason_category || undefined,
        source: form.source || undefined,
        confidence: form.confidence !== '' ? Number(form.confidence) : null,
        status: form.status,
        memo: form.memo || undefined,
      })
      if (result.error) {
        setModalError(result.error)
      } else {
        emitToast('保存しました')
        closeModal()
      }
    })
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-4">
      {/* Guide */}
      <details className="bg-green-50 border border-green-200 rounded-lg text-xs text-green-900">
        <summary className="px-4 py-2.5 cursor-pointer font-medium select-none list-none flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
          ナレッジ事例の管理ルール（クリックで展開）
        </summary>
        <div className="px-4 pb-4 pt-1 space-y-2 leading-relaxed">
          <p className="font-semibold">目的</p>
          <p>よくある問い合わせと推奨返信を登録し、AIが返信案を生成するときの参考データとして使います。「問い合わせパターン」に近い内容が届いたとき、「推奨返信」をベースにAIが回答します。</p>
          <p className="font-semibold mt-2">登録・更新ルール</p>
          <ul className="list-disc list-inside space-y-1">
            <li><span className="font-medium">問い合わせパターン</span>は、顧客が実際に送ってきそうな言葉・文章で記載してください（例:「商品が届かない」「サイズが合わない」）。</li>
            <li><span className="font-medium">推奨返信</span>は、そのまま使えるくらい丁寧な文章で書いてください。</li>
            <li>AIが使うのは<span className="font-medium">ステータス「有効」のデータのみ</span>です。誤った内容があれば「無効化」か編集してください。</li>
            <li><span className="font-medium">信頼度</span>は0〜1の数値。人間が確認・修正したものは0.9以上を目安に設定してください。</li>
            <li>自動保存されたデータ（source: auto_accepted など）は内容を確認し、問題なければそのままでOKです。</li>
            <li>古い・不正確な事例は削除せず「無効化」してください。</li>
          </ul>
          <p className="font-semibold mt-2">反映タイミング</p>
          <p>保存後すぐにAIが参照する対象に反映されます。次回のAI返信案生成から使われます。</p>
        </div>
      </details>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">ナレッジ事例</h2>
        <button
          onClick={openAdd}
          className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          新規追加
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="商品名・問い合わせパターン・返信内容で検索"
          className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">すべて</option>
          <option value="active">有効</option>
          <option value="inactive">無効</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">商品名</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">問い合わせパターン</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">推奨返信</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">理由カテゴリ</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">信頼度</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ステータス</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-sm text-gray-400 py-12">
                  {cases.length === 0 ? 'ナレッジ事例が登録されていません' : '条件に一致するデータがありません'}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className={c.status === 'active' ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 text-gray-900 max-w-[120px] truncate">{c.product_name ?? '─'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[180px]">
                    <span title={c.question ?? ''}>{truncate(c.question, 40)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[180px]">
                    <span title={c.reply_body ?? ''}>{truncate(c.reply_body, 40)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {REASON_CATEGORIES.find((r) => r.value === c.reason_category)?.label ?? c.reason_category ?? '─'}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {c.confidence != null ? (c.confidence * 100).toFixed(0) + '%' : '─'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.status === 'active' ? (
                      <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">有効</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">無効</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="text-xs px-2 py-1 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleToggle(c)}
                        disabled={isPending}
                        className={`text-xs px-2 py-1 rounded-md transition-colors ${
                          c.status === 'active'
                            ? 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                            : 'border border-blue-200 text-blue-600 hover:bg-blue-50'
                        }`}
                      >
                        {c.status === 'active' ? '無効化' : '有効化'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">{filtered.length} 件表示</p>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                {form.id ? 'ナレッジ事例を編集' : 'ナレッジ事例を新規追加'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form id="knowledge-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">商品名</label>
                <input
                  type="text"
                  value={form.product_name}
                  onChange={(e) => setField('product_name', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">問い合わせパターン</label>
                <textarea
                  value={form.question}
                  onChange={(e) => setField('question', e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">推奨返信</label>
                <textarea
                  value={form.reply_body}
                  onChange={(e) => setField('reply_body', e.target.value)}
                  rows={5}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">理由カテゴリ</label>
                <select
                  value={form.reason_category}
                  onChange={(e) => setField('reason_category', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {REASON_CATEGORIES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">信頼度 (0〜1)</label>
                  <input
                    type="number"
                    value={form.confidence}
                    onChange={(e) => setField('confidence', e.target.value)}
                    min="0"
                    max="1"
                    step="0.01"
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ソース</label>
                  <input
                    type="text"
                    value={form.source}
                    onChange={(e) => setField('source', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ステータス</label>
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">有効</option>
                  <option value="inactive">無効</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">メモ</label>
                <textarea
                  value={form.memo}
                  onChange={(e) => setField('memo', e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {modalError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">{modalError}</p>
              )}
              {modalSuccess && (
                <p className="text-xs text-green-600 bg-green-50 rounded-md px-3 py-2">{modalSuccess}</p>
              )}
            </form>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                type="button"
                onClick={closeModal}
                className="text-sm px-4 py-2 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                form="knowledge-form"
                disabled={isPending}
                className="text-sm px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

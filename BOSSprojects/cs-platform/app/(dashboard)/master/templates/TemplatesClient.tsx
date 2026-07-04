'use client'

import { useState, useTransition, useMemo } from 'react'
import { upsertTemplate, toggleTemplate } from './actions'
import { emitToast } from '@/components/ui/toast-emitter'

type Template = {
  id: string
  template_name: string
  mall: string | null
  category: string | null
  body: string
  is_active: boolean
  memo: string | null
  updated_at: string | null
}

type FormState = {
  id?: string
  template_name: string
  mall: string
  category: string
  body: string
  is_active: boolean
  memo: string
}

const emptyForm: FormState = {
  template_name: '',
  mall: '',
  category: '',
  body: '',
  is_active: true,
  memo: '',
}

function templateToForm(t: Template): FormState {
  return {
    id: t.id,
    template_name: t.template_name,
    mall: t.mall ?? '',
    category: t.category ?? '',
    body: t.body,
    is_active: t.is_active,
    memo: t.memo ?? '',
  }
}

function truncate(text: string | null, len: number): string {
  if (!text) return '─'
  return text.length > len ? text.slice(0, len) + '...' : text
}

export function TemplatesClient({ templates }: { templates: Template[] }) {
  const [search, setSearch] = useState('')
  const [filterMall, setFilterMall] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [modalError, setModalError] = useState('')
  const [modalSuccess, setModalSuccess] = useState('')
  const [isPending, startTransition] = useTransition()

  const malls = useMemo(() => {
    const set = new Set<string>()
    templates.forEach((t) => { if (t.mall) set.add(t.mall) })
    return Array.from(set).sort()
  }, [templates])

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        t.template_name.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        (t.category ?? '').toLowerCase().includes(q)
      const matchMall = !filterMall || t.mall === filterMall
      return matchSearch && matchMall
    })
  }, [templates, search, filterMall])

  function openAdd() {
    setForm(emptyForm)
    setModalError('')
    setModalSuccess('')
    setIsModalOpen(true)
  }

  function openEdit(t: Template) {
    setForm(templateToForm(t))
    setModalError('')
    setModalSuccess('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setModalError('')
    setModalSuccess('')
  }

  function handleToggle(t: Template) {
    startTransition(async () => {
      const result = await toggleTemplate(t.id, !t.is_active)
      if (result.error) emitToast(result.error, 'error')
      else emitToast(!t.is_active ? '有効化しました' : '無効化しました')
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setModalError('')
    setModalSuccess('')

    if (!form.template_name.trim()) {
      setModalError('テンプレート名は必須です')
      return
    }
    if (!form.body.trim()) {
      setModalError('本文は必須です')
      return
    }

    startTransition(async () => {
      const result = await upsertTemplate({
        id: form.id,
        template_name: form.template_name.trim(),
        mall: form.mall || undefined,
        category: form.category || undefined,
        body: form.body.trim(),
        is_active: form.is_active,
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
      <details className="bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
        <summary className="px-4 py-2.5 cursor-pointer font-medium select-none list-none flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
          返信テンプレの管理ルール（クリックで展開）
        </summary>
        <div className="px-4 pb-4 pt-1 space-y-2 leading-relaxed">
          <p className="font-semibold">目的</p>
          <p>よく使う返信文を事前登録しておくことで、担当者が素早く返信できるようにします。モール・カテゴリ別に整理しておくと、対応時に絞り込んで見つけやすくなります。</p>
          <p className="font-semibold mt-2">登録・更新ルール</p>
          <ul className="list-disc list-inside space-y-1">
            <li><span className="font-medium">テンプレート名</span>は用途がすぐわかる名前にしてください（例:「交換対応_楽天」「お詫び文_基本」）。</li>
            <li><span className="font-medium">本文</span>には【注文番号】【商品名】などのプレースホルダーを使うと使いまわしやすくなります。</li>
            <li>モール・カテゴリを設定しておくと、問い合わせ対応時の絞り込みが便利です。</li>
            <li>内容が古くなったテンプレは「<span className="font-medium">無効化</span>」してください。削除はしません。無効化したテンプレは一覧に薄く表示されます。</li>
            <li>季節・キャンペーンごとのテンプレは、終了後に無効化しておきましょう。</li>
          </ul>
          <p className="font-semibold mt-2">反映タイミング</p>
          <p>保存後すぐに参照可能になります。</p>
        </div>
      </details>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">返信テンプレ</h2>
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
          placeholder="テンプレート名・本文・カテゴリで検索"
          className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <select
          value={filterMall}
          onChange={(e) => setFilterMall(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">すべてのモール</option>
          {malls.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">テンプレート名</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">モール</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">カテゴリ</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">本文</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ステータス</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-sm text-gray-400 py-12">
                  {templates.length === 0 ? 'テンプレートが登録されていません' : '条件に一致するテンプレートがありません'}
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className={t.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{t.template_name}</td>
                  <td className="px-4 py-3 text-gray-500">{t.mall ?? '─'}</td>
                  <td className="px-4 py-3 text-gray-500">{t.category ?? '─'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[280px]">
                    <span title={t.body}>{truncate(t.body, 60)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.is_active ? (
                      <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">有効</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">無効</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(t)}
                        className="text-xs px-2 py-1 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleToggle(t)}
                        disabled={isPending}
                        className={`text-xs px-2 py-1 rounded-md transition-colors ${
                          t.is_active
                            ? 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                            : 'border border-blue-200 text-blue-600 hover:bg-blue-50'
                        }`}
                      >
                        {t.is_active ? '無効化' : '有効化'}
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
                {form.id ? 'テンプレートを編集' : 'テンプレートを新規追加'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form id="templates-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  テンプレート名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.template_name}
                  onChange={(e) => setField('template_name', e.target.value)}
                  required
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">モール</label>
                  <input
                    type="text"
                    value={form.mall}
                    onChange={(e) => setField('mall', e.target.value)}
                    placeholder="Amazon / 楽天 / Yahoo"
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">カテゴリ</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  本文 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.body}
                  onChange={(e) => setField('body', e.target.value)}
                  rows={8}
                  required
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
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

              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-700">有効</label>
                <button
                  type="button"
                  onClick={() => setField('is_active', !form.is_active)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                    form.is_active ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      form.is_active ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-xs text-gray-500">{form.is_active ? '有効' : '無効'}</span>
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
                form="templates-form"
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

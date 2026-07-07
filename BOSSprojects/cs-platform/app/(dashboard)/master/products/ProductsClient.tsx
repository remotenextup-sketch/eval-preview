'use client'

import { useState, useTransition, useMemo, useRef } from 'react'
import { upsertProduct, upsertProductKnowledge, toggleProduct, deleteProduct, importProducts } from './actions'
import { emitToast } from '@/components/ui/toast-emitter'

type Product = {
  id: string
  product_id: string | null
  sku: string | null
  product_name: string
  mall: string | null
  asin: string | null
  rakuten_item_code: string | null
  yahoo_item_code: string | null
  supplier: string | null
  category: string | null
  price: number | null
  cost: number | null
  is_active: boolean
  memo: string | null
  brand: string | null
  sale_status: string | null
  warranty_days: number | null
  return_shipping_fee: number | null
  dropbox_url: string | null
  rakuten_url: string | null
  parent_product_id: string | null
  updated_at: string | null
}

type Knowledge = {
  id: string
  product_id: string
  synonyms: string[] | null
  features: string | null
  notes: string | null
  campaign_name: string | null
  campaign_detail: string | null
  present_item: string | null
  present_condition: string | null
  present_summary: string | null
  ai_notes: string | null
  priority: number
  is_active: boolean
  updated_at: string | null
}

type BasicForm = {
  id?: string
  product_id: string
  sku: string
  product_name: string
  mall: string
  asin: string
  rakuten_item_code: string
  yahoo_item_code: string
  supplier: string
  category: string
  price: string
  cost: string
  is_active: boolean
  memo: string
  brand: string
  sale_status: string
  warranty_days: string
  return_shipping_fee: string
  dropbox_url: string
  rakuten_url: string
}

type CsForm = {
  id?: string
  product_id: string
  synonymsText: string
  features: string
  notes: string
  campaign_name: string
  campaign_detail: string
  present_item: string
  present_condition: string
  present_summary: string
  ai_notes: string
  priority: string
}

const emptyBasic: BasicForm = {
  product_id: '', sku: '', product_name: '', mall: '', asin: '',
  rakuten_item_code: '', yahoo_item_code: '', supplier: '', category: '',
  price: '', cost: '', is_active: true, memo: '', brand: '', sale_status: 'active',
  warranty_days: '', return_shipping_fee: '', dropbox_url: '', rakuten_url: '',
}

const emptyCsForm = (productId = ''): CsForm => ({
  product_id: productId, synonymsText: '', features: '', notes: '',
  campaign_name: '', campaign_detail: '', present_item: '', present_condition: '',
  present_summary: '', ai_notes: '', priority: '0',
})

function productToBasic(p: Product): BasicForm {
  return {
    id: p.id,
    product_id: p.product_id ?? '',
    sku: p.sku ?? '',
    product_name: p.product_name,
    mall: p.mall ?? '',
    asin: p.asin ?? '',
    rakuten_item_code: p.rakuten_item_code ?? '',
    yahoo_item_code: p.yahoo_item_code ?? '',
    supplier: p.supplier ?? '',
    category: p.category ?? '',
    price: p.price != null ? String(p.price) : '',
    cost: p.cost != null ? String(p.cost) : '',
    is_active: p.is_active,
    memo: p.memo ?? '',
    brand: p.brand ?? '',
    sale_status: p.sale_status ?? 'active',
    warranty_days: p.warranty_days != null ? String(p.warranty_days) : '',
    return_shipping_fee: p.return_shipping_fee != null ? String(p.return_shipping_fee) : '',
    dropbox_url: p.dropbox_url ?? '',
    rakuten_url: p.rakuten_url ?? '',
  }
}

function knowledgeToCs(k: Knowledge): CsForm {
  return {
    id: k.id,
    product_id: k.product_id,
    synonymsText: (k.synonyms ?? []).join('、'),
    features: k.features ?? '',
    notes: k.notes ?? '',
    campaign_name: k.campaign_name ?? '',
    campaign_detail: k.campaign_detail ?? '',
    present_item: k.present_item ?? '',
    present_condition: k.present_condition ?? '',
    present_summary: k.present_summary ?? '',
    ai_notes: k.ai_notes ?? '',
    priority: String(k.priority ?? 0),
  }
}

// CSV import types
type CsvRow = Record<string, string>
type ColumnMap = {
  product_name: string
  sku: string
  asin: string
  rakuten_item_code: string
  yahoo_item_code: string
  brand: string
  category: string
  mall: string
  price: string
  cost: string
  warranty_days: string
  sale_status: string
  memo: string
  synonyms: string
  features: string
  notes: string
}
const CSV_TARGET_COLS: (keyof ColumnMap)[] = [
  'product_name','sku','asin','rakuten_item_code','yahoo_item_code',
  'brand','category','mall','price','cost','warranty_days','sale_status',
  'memo','synonyms','features','notes',
]
const CSV_COL_LABELS: Record<keyof ColumnMap, string> = {
  product_name: '商品名 *', sku: 'SKU', asin: 'ASIN', rakuten_item_code: '楽天商品コード',
  yahoo_item_code: 'Yahoo商品コード', brand: 'ブランド', category: 'カテゴリ',
  mall: 'モール', price: '価格', cost: '原価', warranty_days: '保証日数',
  sale_status: '販売状況', memo: 'メモ', synonyms: '別名（カンマ区切り）',
  features: '商品特徴', notes: 'CS備考',
}

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    const row: CsvRow = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
  return { headers, rows }
}

export function ProductsClient({
  products,
  knowledgeRows,
}: {
  products: Product[]
  knowledgeRows: Knowledge[]
}) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'basic' | 'cs'>('basic')
  const [basic, setBasic] = useState<BasicForm>(emptyBasic)
  const [cs, setCs] = useState<CsForm>(emptyCsForm())
  const [modalError, setModalError] = useState('')
  const [modalSuccess, setModalSuccess] = useState('')
  const [isPending, startTransition] = useTransition()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // CSV import state
  const [csvStep, setCsvStep] = useState<'idle' | 'map' | 'preview' | 'done'>('idle')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [colMap, setColMap] = useState<ColumnMap>({} as ColumnMap)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const knowledgeByProduct = useMemo(() => {
    const m = new Map<string, Knowledge>()
    knowledgeRows.forEach((k) => m.set(k.product_id, k))
    return m
  }, [knowledgeRows])

  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => { if (p.category) set.add(p.category) })
    return Array.from(set).sort()
  }, [products])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase()
      const k = knowledgeByProduct.get(p.id)
      const matchSearch =
        !q ||
        p.product_name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.mall ?? '').toLowerCase().includes(q) ||
        (p.supplier ?? '').toLowerCase().includes(q) ||
        (p.brand ?? '').toLowerCase().includes(q) ||
        (k?.synonyms ?? []).some((s) => s.toLowerCase().includes(q))
      const matchCategory = !filterCategory || p.category === filterCategory
      return matchSearch && matchCategory
    })
  }, [products, search, filterCategory, knowledgeByProduct])

  function openAdd() {
    setBasic(emptyBasic)
    setCs(emptyCsForm())
    setModalError('')
    setModalSuccess('')
    setModalTab('basic')
    setIsModalOpen(true)
  }

  function openEdit(p: Product) {
    setBasic(productToBasic(p))
    const k = knowledgeByProduct.get(p.id)
    setCs(k ? knowledgeToCs(k) : emptyCsForm(p.id))
    setModalError('')
    setModalSuccess('')
    setModalTab('basic')
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setModalError('')
    setModalSuccess('')
  }

  function handleToggle(p: Product) {
    startTransition(async () => {
      const result = await toggleProduct(p.id, !p.is_active)
      if (result.error) emitToast(result.error, 'error')
      else emitToast(!p.is_active ? '有効化しました' : '無効化しました')
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteProduct(id)
      setConfirmDeleteId(null)
      if (result.error) emitToast(result.error, 'error')
      else emitToast('削除しました')
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setModalError('')
    setModalSuccess('')

    if (!basic.product_name.trim()) {
      setModalError('商品名は必須です')
      return
    }

    startTransition(async () => {
      const result = await upsertProduct({
        id: basic.id,
        product_id: basic.product_id || undefined,
        sku: basic.sku || undefined,
        product_name: basic.product_name.trim(),
        mall: basic.mall || undefined,
        asin: basic.asin || undefined,
        rakuten_item_code: basic.rakuten_item_code || undefined,
        yahoo_item_code: basic.yahoo_item_code || undefined,
        supplier: basic.supplier || undefined,
        category: basic.category || undefined,
        price: basic.price !== '' ? Number(basic.price) : null,
        cost: basic.cost !== '' ? Number(basic.cost) : null,
        is_active: basic.is_active,
        memo: basic.memo || undefined,
        brand: basic.brand || undefined,
        sale_status: basic.sale_status || 'active',
        warranty_days: basic.warranty_days !== '' ? Number(basic.warranty_days) : null,
        return_shipping_fee: basic.return_shipping_fee !== '' ? Number(basic.return_shipping_fee) : null,
        dropbox_url: basic.dropbox_url || undefined,
        rakuten_url: basic.rakuten_url || undefined,
      })
      if (result.error) { setModalError(result.error); return }

      const productId = result.id ?? basic.id!
      const csResult = await upsertProductKnowledge({
        id: cs.id,
        product_id: productId,
        synonyms: cs.synonymsText
          ? cs.synonymsText.split(/[,、\n]/).map((s) => s.trim()).filter(Boolean)
          : [],
        features: cs.features || undefined,
        notes: cs.notes || undefined,
        campaign_name: cs.campaign_name || undefined,
        campaign_detail: cs.campaign_detail || undefined,
        present_item: cs.present_item || undefined,
        present_condition: cs.present_condition || undefined,
        present_summary: cs.present_summary || undefined,
        ai_notes: cs.ai_notes || undefined,
        priority: cs.priority !== '' ? Number(cs.priority) : 0,
      })

      if (csResult.error) { setModalError(csResult.error); return }

      emitToast('保存しました')
      closeModal()
    })
  }

  function setB<K extends keyof BasicForm>(key: K, value: BasicForm[K]) {
    setBasic((prev) => ({ ...prev, [key]: value }))
  }
  function setC<K extends keyof CsForm>(key: K, value: CsForm[K]) {
    setCs((prev) => ({ ...prev, [key]: value }))
  }

  // CSV import handlers
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers, rows } = parseCsv(text)
      setCsvHeaders(headers)
      setCsvRows(rows)
      // Auto-map by matching header names
      const autoMap: Partial<ColumnMap> = {}
      CSV_TARGET_COLS.forEach((col) => {
        const match = headers.find(
          (h) => h.toLowerCase().replace(/[\s_-]/g, '') === col.toLowerCase().replace(/[\s_-]/g, ''),
        )
        if (match) autoMap[col] = match
      })
      setColMap(autoMap as ColumnMap)
      setCsvStep('map')
    }
    reader.readAsText(file, 'utf-8')
  }

  function mappedRows() {
    return csvRows.map((row) => {
      const mapped: Record<string, string> = {}
      CSV_TARGET_COLS.forEach((col) => {
        if (colMap[col]) mapped[col] = row[colMap[col]] ?? ''
      })
      return mapped
    })
  }

  function handleImport() {
    const rows = mappedRows().map((r) => ({
      product_name: r.product_name ?? '',
      sku: r.sku || undefined,
      asin: r.asin || undefined,
      rakuten_item_code: r.rakuten_item_code || undefined,
      yahoo_item_code: r.yahoo_item_code || undefined,
      brand: r.brand || undefined,
      category: r.category || undefined,
      mall: r.mall || undefined,
      price: r.price ? Number(r.price) : null,
      cost: r.cost ? Number(r.cost) : null,
      warranty_days: r.warranty_days ? Number(r.warranty_days) : null,
      sale_status: r.sale_status || undefined,
      memo: r.memo || undefined,
      synonyms: r.synonyms || undefined,
      features: r.features || undefined,
      notes: r.notes || undefined,
    }))

    startTransition(async () => {
      const result = await importProducts(rows)
      if (result.error) {
        emitToast(result.error, 'error')
      } else {
        setImportResult({ imported: result.imported, skipped: result.skipped })
        setCsvStep('done')
        emitToast(`${result.imported}件インポートしました`)
        if (fileRef.current) fileRef.current.value = ''
      }
    })
  }

  function resetCsv() {
    setCsvStep('idle')
    setCsvHeaders([])
    setCsvRows([])
    setColMap({} as ColumnMap)
    setImportResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const previewRows = mappedRows().slice(0, 5)

  return (
    <div className="space-y-4">
      {/* Guide */}
      <details className="bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
        <summary className="px-4 py-2.5 cursor-pointer font-medium select-none list-none flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
          商品マスタの管理ルール（クリックで展開）
        </summary>
        <div className="px-4 pb-4 pt-1 space-y-2 leading-relaxed">
          <p className="font-semibold">目的</p>
          <p>商品の基本情報（SKU・ASIN・価格など）とCS対応情報（別名・特徴・キャンペーン・プレゼント条件）を一元管理します。AI返信生成時はこちらの情報を参照します。</p>
          <p className="font-semibold mt-2">タブ構成</p>
          <ul className="list-disc list-inside space-y-1">
            <li><span className="font-medium">基本情報タブ</span>：SKU・ASIN・価格・保証日数など商品スペック</li>
            <li><span className="font-medium">CS情報タブ</span>：別名・商品特徴・キャンペーン・プレゼント条件・AIメモ。AI返信に直接影響します</li>
          </ul>
          <p className="font-semibold mt-2">CSVインポート</p>
          <p>商品名が一致する場合はスキップ（重複登録防止）。synonyms列はカンマ区切りで複数入力可。</p>
          <p className="font-semibold mt-2">反映タイミング</p>
          <p>保存後すぐにAI返信生成へ反映されます。</p>
        </div>
      </details>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">商品マスタ</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm px-3 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
            CSVインポート
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          <button
            onClick={openAdd}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            新規追加
          </button>
        </div>
      </div>

      {/* CSV import flow */}
      {csvStep !== 'idle' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          {csvStep === 'map' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">カラムマッピング（{csvRows.length}行）</p>
                <button onClick={resetCsv} className="text-xs text-gray-400 hover:text-gray-600">キャンセル</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {CSV_TARGET_COLS.map((col) => (
                  <div key={col} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-36 flex-shrink-0">{CSV_COL_LABELS[col]}</span>
                    <select
                      value={colMap[col] ?? ''}
                      onChange={(e) => setColMap((prev) => ({ ...prev, [col]: e.target.value }))}
                      className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">（スキップ）</option>
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCsvStep('preview')}
                  disabled={!colMap.product_name}
                  className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  プレビュー確認
                </button>
              </div>
            </>
          )}

          {csvStep === 'preview' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">プレビュー（先頭5件）</p>
                <button onClick={() => setCsvStep('map')} className="text-xs text-gray-400 hover:text-gray-600">← 戻る</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      {CSV_TARGET_COLS.filter((c) => colMap[c]).map((c) => (
                        <th key={c} className="border border-gray-200 px-2 py-1 text-left text-gray-500">{CSV_COL_LABELS[c]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {CSV_TARGET_COLS.filter((c) => colMap[c]).map((c) => (
                          <td key={c} className="border border-gray-200 px-2 py-1 text-gray-700 max-w-xs truncate">{row[c]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400">全{csvRows.length}件をインポートします。既存の商品名と一致する行はスキップされます。</p>
              <button
                onClick={handleImport}
                disabled={isPending}
                className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'インポート中...' : 'インポート実行'}
              </button>
            </>
          )}

          {csvStep === 'done' && importResult && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-green-700">
                完了：<span className="font-semibold">{importResult.imported}件</span>追加、
                <span className="font-semibold">{importResult.skipped}件</span>スキップ
              </p>
              <button onClick={resetCsv} className="text-xs text-gray-400 hover:text-gray-600">閉じる</button>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="商品名・SKU・ブランド・別名で検索"
          className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">すべてのカテゴリ</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">商品名</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ブランド</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">カテゴリ</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">価格</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">再送料</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">保証</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ステータス</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-sm text-gray-400 py-12">
                  {products.length === 0 ? '商品が登録されていません' : '条件に一致する商品がありません'}
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const k = knowledgeByProduct.get(p.id)
                return (
                  <tr key={p.id} className={p.is_active ? '' : 'opacity-50'}>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{p.product_name}</span>
                        {p.rakuten_url && (
                          <a
                            href={p.rakuten_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="楽天ページ"
                            className="flex-shrink-0 text-xs text-gray-300 hover:text-red-500 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            楽↗
                          </a>
                        )}
                        {p.dropbox_url && (
                          <a
                            href={p.dropbox_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Dropbox"
                            className="flex-shrink-0 text-xs text-gray-300 hover:text-blue-500 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            DB↗
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku ?? '─'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.brand ?? '─'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.category ?? '─'}</td>
                    <td className="px-4 py-3 text-gray-700 text-right">
                      {p.price != null ? `¥${p.price.toLocaleString()}` : '─'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-right text-xs">
                      {p.return_shipping_fee != null ? `¥${p.return_shipping_fee.toLocaleString()}` : '─'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-right text-xs">
                      {p.warranty_days != null ? `${p.warranty_days}日` : '─'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.is_active ? (
                        <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">有効</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">無効</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmDeleteId === p.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-xs text-red-600 font-medium">削除しますか？</span>
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={isPending}
                            className="text-xs px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            削除
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={isPending}
                            className="text-xs px-2 py-1 border border-gray-200 text-gray-500 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="text-xs px-2 py-1 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleToggle(p)}
                            disabled={isPending}
                            className={`text-xs px-2 py-1 rounded-md transition-colors ${
                              p.is_active
                                ? 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                                : 'border border-blue-200 text-blue-600 hover:bg-blue-50'
                            }`}
                          >
                            {p.is_active ? '無効化' : '有効化'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(p.id)}
                            disabled={isPending}
                            className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded-md hover:bg-red-50 transition-colors"
                          >
                            削除
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                {basic.id ? '商品を編集' : '商品を新規追加'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6">
              {(['basic', 'cs'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setModalTab(tab)}
                  className={`text-sm px-4 py-2.5 -mb-px border-b-2 transition-colors ${
                    modalTab === tab
                      ? 'border-blue-600 text-blue-600 font-medium'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'basic' ? '基本情報' : 'CS情報'}
                </button>
              ))}
            </div>

            <form id="products-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4">
              {modalTab === 'basic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">商品名 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={basic.product_name}
                      onChange={(e) => setB('product_name', e.target.value)}
                      required
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">SKU</label>
                      <input type="text" value={basic.sku} onChange={(e) => setB('sku', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">ブランド</label>
                      <input type="text" value={basic.brand} onChange={(e) => setB('brand', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">カテゴリ</label>
                      <input type="text" value={basic.category} onChange={(e) => setB('category', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">モール</label>
                      <input type="text" value={basic.mall} onChange={(e) => setB('mall', e.target.value)}
                        placeholder="Amazon / 楽天 / Yahoo"
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ASIN</label>
                    <input type="text" value={basic.asin} onChange={(e) => setB('asin', e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">楽天商品コード</label>
                      <input type="text" value={basic.rakuten_item_code} onChange={(e) => setB('rakuten_item_code', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Yahoo商品コード</label>
                      <input type="text" value={basic.yahoo_item_code} onChange={(e) => setB('yahoo_item_code', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">価格</label>
                      <input type="number" value={basic.price} onChange={(e) => setB('price', e.target.value)}
                        min="0" step="1"
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">原価</label>
                      <input type="number" value={basic.cost} onChange={(e) => setB('cost', e.target.value)}
                        min="0" step="1"
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">保証日数</label>
                      <input type="number" value={basic.warranty_days} onChange={(e) => setB('warranty_days', e.target.value)}
                        min="0" step="1"
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">再送料（円）</label>
                      <input type="number" value={basic.return_shipping_fee} onChange={(e) => setB('return_shipping_fee', e.target.value)}
                        min="0" step="1"
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">販売状況</label>
                      <select value={basic.sale_status} onChange={(e) => setB('sale_status', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="active">販売中</option>
                        <option value="discontinued">廃番</option>
                        <option value="limited">限定販売</option>
                        <option value="out_of_stock">在庫切れ</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Dropbox URL</label>
                      <input type="url" value={basic.dropbox_url} onChange={(e) => setB('dropbox_url', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">楽天URL</label>
                      <input type="url" value={basic.rakuten_url} onChange={(e) => setB('rakuten_url', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">メモ</label>
                    <textarea value={basic.memo} onChange={(e) => setB('memo', e.target.value)}
                      rows={2}
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                </div>
              )}

              {modalTab === 'cs' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">別名・呼び方（カンマ・読点区切り）</label>
                    <input type="text" value={cs.synonymsText} onChange={(e) => setC('synonymsText', e.target.value)}
                      placeholder="例: ウォーターボトル、水筒、マイボトル"
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <p className="text-xs text-gray-400 mt-1">AI返信の商品検索に使われます</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">商品特徴・仕様</label>
                    <textarea value={cs.features} onChange={(e) => setC('features', e.target.value)}
                      rows={3} placeholder="素材、サイズ、容量、使い方など"
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">CS備考</label>
                    <textarea value={cs.notes} onChange={(e) => setC('notes', e.target.value)}
                      rows={2} placeholder="返品不可の理由、よくある問い合わせへの注意点など"
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-gray-600 mb-3">キャンペーン情報</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">キャンペーン名</label>
                        <input type="text" value={cs.campaign_name} onChange={(e) => setC('campaign_name', e.target.value)}
                          className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">キャンペーン詳細</label>
                        <textarea value={cs.campaign_detail} onChange={(e) => setC('campaign_detail', e.target.value)}
                          rows={2}
                          className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-gray-600 mb-3">プレゼント条件</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">プレゼント商品</label>
                        <input
                          type="text"
                          value={cs.present_item}
                          onChange={(e) => setC('present_item', e.target.value)}
                          list="present-product-datalist"
                          placeholder="商品名を入力または選択"
                          className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <datalist id="present-product-datalist">
                          {products.map((p) => (
                            <option key={p.id} value={p.product_name} />
                          ))}
                        </datalist>
                        <p className="text-xs text-gray-400 mt-1">商品マスタから選択、または直接入力</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">条件</label>
                        <input type="text" value={cs.present_condition} onChange={(e) => setC('present_condition', e.target.value)}
                          placeholder="例: 2個以上購入"
                          className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">まとめ文（AI返信用）</label>
                        <textarea value={cs.present_summary} onChange={(e) => setC('present_summary', e.target.value)}
                          rows={2} placeholder="AIが返信に挿入するプレゼント説明文"
                          className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">AIメモ</label>
                    <textarea value={cs.ai_notes} onChange={(e) => setC('ai_notes', e.target.value)}
                      rows={2} placeholder="AIに渡す追加コンテキスト（対応トーン、禁止ワードなど）"
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">優先度（数字が大きいほど優先）</label>
                    <input type="number" value={cs.priority} onChange={(e) => setC('priority', e.target.value)}
                      min="0" max="100" step="1"
                      className="w-32 text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}

              {modalError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2 mt-4">{modalError}</p>
              )}
              {modalSuccess && (
                <p className="text-xs text-green-600 bg-green-50 rounded-md px-3 py-2 mt-4">{modalSuccess}</p>
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
                form="products-form"
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

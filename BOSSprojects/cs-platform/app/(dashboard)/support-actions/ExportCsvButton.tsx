'use client'

import { useState } from 'react'

type SearchParams = Record<string, string | undefined>

export function ExportCsvButton({ searchParams }: { searchParams: SearchParams }) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      for (const [k, v] of Object.entries(searchParams)) if (v) p.set(k, v)
      const res = await fetch(`/api/support-actions/export?${p.toString()}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `support-actions-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('CSVエクスポートに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors"
    >
      {loading ? 'エクスポート中...' : 'CSV出力'}
    </button>
  )
}

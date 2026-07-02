import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SearchInput } from './SearchInput'
import type { InquiryStatus, DbTag } from '@/lib/types'

const STATUS_LABELS: Record<InquiryStatus, string> = {
  open: '未対応',
  pending: '保留中',
  resolved: '対応完了',
  spam: '対応不要',
}

const STATUS_COLORS: Record<InquiryStatus, string> = {
  open: 'bg-blue-100 text-blue-600',
  pending: 'bg-orange-100 text-orange-600',
  resolved: 'bg-green-100 text-green-600',
  spam: 'bg-gray-100 text-gray-500',
}

interface Props {
  currentStatus: InquiryStatus
  tagId?: string
  q?: string
  mine?: boolean
}

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, v)
  }
  const qs = p.toString()
  return qs ? `${base}?${qs}` : base
}

export async function ListPanel({ currentStatus, tagId, q, mine }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ count: openCount }, { count: pendingCount }] = await Promise.all([
    supabase
      .from('inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')
      .eq('needs_human', true),
    supabase
      .from('inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])
  const countMap: Record<string, number> = {
    open: openCount ?? 0,
    pending: pendingCount ?? 0,
  }

  const { count: mineCount } = user
    ? await supabase
        .from('inquiries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .eq('assignee_id', user.id)
    : { count: 0 }

  const { data: allTags } = await supabase.from('tags').select('*').order('name', { ascending: true })
  const tags = (allTags ?? []) as unknown as DbTag[]

  const statuses = Object.keys(STATUS_LABELS) as InquiryStatus[]
  const isCustomActive = mine === true
  const activeStatus = isCustomActive ? null : currentStatus

  return (
    <aside className="w-52 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white overflow-hidden">
      <div className="p-3 border-b border-gray-100 flex-shrink-0">
        <SearchInput
          defaultValue={q ?? ''}
          defaultTagId={tagId ?? ''}
          status={currentStatus}
          tags={tags}
        />
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-2 space-y-0.5">
          {statuses.map((s) => {
            const isActive = activeStatus === s
            return (
              <Link
                key={s}
                href={buildUrl('/inbox', { status: s, q, tag: tagId })}
                className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{STATUS_LABELS[s]}</span>
                {(countMap[s] ?? 0) > 0 && (
                  <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                    isActive ? 'bg-blue-100 text-blue-600' : STATUS_COLORS[s]
                  }`}>
                    {countMap[s]}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        <div className="px-2 mt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 pb-1.5">
            カスタムクエリ
          </p>
          <div className="space-y-0.5">
            <Link
              href="/inbox?status=open&mine=1"
              className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${
                mine ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>自分が担当</span>
              {(mineCount ?? 0) > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                  mine ? 'bg-blue-100 text-blue-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {mineCount}
                </span>
              )}
            </Link>
            <Link
              href="/inbox?status=open&q=%E8%BF%94%E5%93%81"
              className="flex items-center px-2 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              返品案件
            </Link>
            <Link
              href="/inbox?status=pending&q=%E3%83%A1%E3%83%BC%E3%82%AB%E3%83%BC"
              className="flex items-center px-2 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              メーカー確認中
            </Link>
          </div>
        </div>
      </div>
    </aside>
  )
}

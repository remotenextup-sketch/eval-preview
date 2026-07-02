import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SupabaseClient } from '@supabase/supabase-js'
import { AiConsultButton } from './AiConsultButton'

type FeedbackVote = { id: string; user_id: string }
type FeedbackItem = {
  id: string
  title: string
  category: string
  priority: string
  status: string
  target_page: string | null
  created_by: string
  created_at: string
  feedback_votes: FeedbackVote[]
}

const CATEGORY_STYLE: Record<string, string> = {
  バグ: 'bg-red-100 text-red-700',
  改善: 'bg-blue-100 text-blue-700',
  要望: 'bg-purple-100 text-purple-700',
  質問: 'bg-gray-100 text-gray-600',
}

const PRIORITY_STYLE: Record<string, { dot: string; label: string }> = {
  High:   { dot: 'bg-red-500',  label: 'High' },
  Normal: { dot: 'bg-gray-400', label: 'Normal' },
  Low:    { dot: 'bg-gray-300', label: 'Low' },
}

const STATUS_STYLE: Record<string, string> = {
  Open:  'text-green-700',
  Doing: 'text-yellow-700',
  Done:  'text-gray-400',
}

const STATUS_ICON: Record<string, string> = {
  Open:  '○',
  Doing: '◑',
  Done:  '✓',
}

type Props = { searchParams: Promise<{ status?: string }> }

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60)  return `${mins}分前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}時間前`
  return `${Math.floor(hrs / 24)}日前`
}

export default async function FeedbackPage({ searchParams }: Props) {
  const { status: statusFilter } = await searchParams
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as SupabaseClient<any>
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let query = supabase
    .from('feedback_items')
    .select('*, feedback_votes(id, user_id)')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data } = await query
  const list = (data ?? []) as FeedbackItem[]

  const tabs = [
    { key: 'all',   label: 'すべて' },
    { key: 'Open',  label: 'Open' },
    { key: 'Doing', label: 'Doing' },
    { key: 'Done',  label: 'Done' },
  ]
  const active = statusFilter ?? 'all'

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-base font-semibold text-gray-900">改善バックログ</h1>
          <div className="flex items-center gap-2">
            <AiConsultButton />
            <Link
              href="/feedback/new"
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors"
            >
              + 新規追加
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {tabs.map(({ key, label }) => (
            <Link
              key={key}
              href={key === 'all' ? '/feedback' : `/feedback?status=${key}`}
              className={`text-sm px-3 py-1.5 border-b-2 transition-colors ${
                active === key
                  ? 'border-blue-600 text-blue-700 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* List */}
        {list.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">該当するアイテムはありません</p>
        ) : (
          <div className="space-y-2">
            {list.map((item) => {
              const votes  = item.feedback_votes ?? []
              const voted  = votes.some((v) => v.user_id === user.id)
              const pStyle = PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE.Normal
              const catCls = CATEGORY_STYLE[item.category] ?? 'bg-gray-100 text-gray-600'
              const stCls  = STATUS_STYLE[item.status] ?? 'text-gray-500'
              const stIcon = STATUS_ICON[item.status] ?? '○'

              return (
                <Link
                  key={item.id}
                  href={`/feedback/${item.id}`}
                  className="block bg-white border border-gray-200 rounded-md px-4 py-3 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={`mt-0.5 text-sm shrink-0 ${stCls}`}>{stIcon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${catCls}`}>
                            {item.category}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <span className={`w-2 h-2 rounded-full ${pStyle.dot}`} />
                            {pStyle.label}
                          </span>
                          {item.target_page && (
                            <span className="text-xs text-gray-400">{item.target_page}</span>
                          )}
                          <span className="text-xs text-gray-400">
                            {item.created_by} · {relativeTime(item.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 shrink-0 text-xs ${voted ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                      👍 {votes.length}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

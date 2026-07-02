import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { SupabaseClient } from '@supabase/supabase-js'
import { updateStatus, toggleVote, deleteFeedback } from '../actions'
import { DeleteFeedbackButton } from '../DeleteFeedbackButton'

type FeedbackVote = { id: string; user_id: string }
type FeedbackItem = {
  id: string
  title: string
  content: string
  category: string
  priority: string
  status: string
  target_page: string | null
  created_by: string
  created_at: string
  resolved_at: string | null
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

const STATUSES = ['Open', 'Doing', 'Done'] as const

type Props = { params: Promise<{ id: string }> }

export default async function FeedbackDetailPage({ params }: Props) {
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as SupabaseClient<any>
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('feedback_items')
    .select('*, feedback_votes(id, user_id)')
    .eq('id', id)
    .single()

  if (!data) notFound()

  const item   = data as FeedbackItem
  const votes  = item.feedback_votes ?? []
  const voted  = votes.some((v) => v.user_id === user.id)
  const catCls = CATEGORY_STYLE[item.category] ?? 'bg-gray-100 text-gray-600'
  const pStyle = PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE.Normal

  const voteAction = async () => {
    'use server'
    await toggleVote(id)
  }

  const deleteAction = async () => {
    'use server'
    await deleteFeedback(id)
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/feedback" className="text-xs text-gray-400 hover:text-gray-600">
          ← 改善バックログ
        </Link>

        <div className="bg-white border border-gray-200 rounded-md mt-4">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-sm font-semibold text-gray-900">{item.title}</h1>
              <form action={voteAction}>
                <button
                  type="submit"
                  className={`flex items-center gap-1 text-xs border rounded-md px-2 py-1 transition-colors shrink-0 ${
                    voted
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  👍 {votes.length}
                </button>
              </form>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                {item.created_by} ·{' '}
                {new Date(item.created_at).toLocaleDateString('ja-JP', {
                  year: 'numeric', month: 'numeric', day: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.content}</p>
          </div>

          {/* Status */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-gray-500 mb-2">ステータス</p>
            <div className="flex gap-2">
              {STATUSES.map((s) => {
                const isActive = item.status === s
                const changeAction = async () => {
                  'use server'
                  await updateStatus(id, s)
                }
                return (
                  <form key={s} action={changeAction}>
                    <button
                      type="submit"
                      disabled={isActive}
                      className={`text-xs border rounded-md px-3 py-1.5 transition-colors ${
                        isActive
                          ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium cursor-default'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      {s === 'Open' ? '○ Open' : s === 'Doing' ? '◑ Doing' : '✓ Done'}
                    </button>
                  </form>
                )
              })}
            </div>
            {item.resolved_at && (
              <p className="text-xs text-gray-400 mt-2">
                完了日：{new Date(item.resolved_at).toLocaleDateString('ja-JP')}
              </p>
            )}
          </div>
        </div>

        {/* Delete */}
        <div className="mt-4 flex justify-end">
          <form action={deleteAction}>
            <DeleteFeedbackButton />
          </form>
        </div>

        {/* Comments placeholder */}
        <div className="mt-4 bg-white border border-gray-200 rounded-md px-5 py-4">
          <p className="text-xs font-medium text-gray-500 mb-2">コメント</p>
          <p className="text-xs text-gray-400">コメント機能は後日追加予定です。</p>
        </div>
      </div>
    </div>
  )
}

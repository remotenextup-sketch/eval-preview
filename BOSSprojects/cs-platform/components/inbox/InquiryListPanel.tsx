import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { InquiryStatus, SourceChannel } from '@/lib/types'
import { RefreshButton } from './RefreshButton'
import { InquiryList } from './InquiryList'

interface Props {
  currentStatus: InquiryStatus
  tagId?: string
  q?: string
  mine?: boolean
  selectedId?: string
  channel?: string
}

const EMAIL_CHANNELS: SourceChannel[] = ['email']
const RAKUTEN_CHANNELS: SourceChannel[] = ['rakuten']
const OTHER_EXCLUDE: SourceChannel[] = ['rakuten', 'email']

type ChannelTab = { key: string; label: string }
const CHANNEL_TABS: ChannelTab[] = [
  { key: '',       label: 'すべて' },
  { key: 'rakuten', label: '楽天' },
  { key: 'email',   label: 'メール' },
  { key: 'other',   label: 'その他' },
]

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, v)
  }
  const qs = p.toString()
  return qs ? `${base}?${qs}` : base
}


export async function InquiryListPanel({ currentStatus, tagId, q, mine, selectedId, channel }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Tag filter pre-fetch
  let inquiryIds: string[] | null = null
  if (tagId) {
    const { data: taggedRows } = await supabase
      .from('inquiry_tags')
      .select('inquiry_id')
      .eq('tag_id', tagId)
    inquiryIds = (taggedRows ?? []).map((r) => (r as { inquiry_id: string }).inquiry_id)
  }

  // Count badges (always open + needs_human, regardless of selected status)
  const baseCount = supabase.from('inquiries').select('*', { count: 'exact', head: true })
    .eq('status', 'open').eq('needs_human', true)

  const [
    { count: totalCount },
    { count: rakutenCount },
    { count: emailCount },
    { count: otherCount },
  ] = await Promise.all([
    baseCount,
    supabase.from('inquiries').select('*', { count: 'exact', head: true })
      .eq('status', 'open').eq('needs_human', true).in('source_channel', RAKUTEN_CHANNELS),
    supabase.from('inquiries').select('*', { count: 'exact', head: true })
      .eq('status', 'open').eq('needs_human', true).in('source_channel', EMAIL_CHANNELS),
    supabase.from('inquiries').select('*', { count: 'exact', head: true })
      .eq('status', 'open').eq('needs_human', true)
      .not('source_channel', 'in', `(${OTHER_EXCLUDE.join(',')})`),
  ])

  const tabCounts: Record<string, number> = {
    '':        totalCount   ?? 0,
    rakuten:   rakutenCount ?? 0,
    email:     emailCount   ?? 0,
    other:     otherCount   ?? 0,
  }

  // Main inquiry query
  let query = supabase
    .from('inquiries')
    .select('id, customer_name, subject, order_number, status, source_channel, received_at, is_angry, needs_human, scheduled_reply_at')
    .eq('status', currentStatus)
    .order('received_at', { ascending: true })

  if (currentStatus === 'open') {
    query = query.eq('needs_human', true)
  }

  if (channel === 'rakuten') {
    query = query.in('source_channel', RAKUTEN_CHANNELS)
  } else if (channel === 'email') {
    query = query.in('source_channel', EMAIL_CHANNELS)
  } else if (channel === 'other') {
    query = query.not('source_channel', 'in', `(${OTHER_EXCLUDE.join(',')})`)
  }

  if (mine && user) {
    query = query.eq('assignee_id', user.id)
  }

  if (inquiryIds !== null) {
    query = inquiryIds.length === 0
      ? query.in('id', ['00000000-0000-0000-0000-000000000000'])
      : query.in('id', inquiryIds)
  }

  if (q) {
    const like = `%${q}%`
    query = query.or(
      `customer_name.ilike.${like},order_number.ilike.${like},inquiry_number.ilike.${like},subject.ilike.${like}`
    )
  }

  const { data: inquiries } = await query

  const tabBase = { status: currentStatus, q, tag: tagId, mine: mine ? '1' : undefined }
  const activeChannel = channel ?? ''

  return (
    <div className="w-72 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white overflow-hidden">
      {/* Channel filter tabs */}
      <div className="px-3 pt-2 pb-1.5 border-b border-gray-100 flex-shrink-0 flex gap-1">
        {CHANNEL_TABS.map(({ key, label }) => {
          const isActive = activeChannel === key
          const count = tabCounts[key] ?? 0
          return (
            <Link
              key={key}
              href={buildUrl('/inbox', { ...tabBase, channel: key || undefined })}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none font-medium ${
                  isActive ? 'bg-blue-500 text-white' : 'bg-red-100 text-red-600'
                }`}>
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
        <p className="text-xs text-gray-400">{(inquiries ?? []).length} 件</p>
        <RefreshButton showLabel={false} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <InquiryList
          inquiries={(inquiries ?? []) as any}
          selectedId={selectedId}
          currentStatus={currentStatus}
          channel={channel}
          tagId={tagId}
          q={q}
          mine={mine}
        />
      </div>
    </div>
  )
}

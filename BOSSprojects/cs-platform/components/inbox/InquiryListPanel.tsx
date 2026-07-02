import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { InquiryStatus, SourceChannel } from '@/lib/types'
import { channelMeta } from '@/lib/channel-meta'

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
    .select('id, customer_name, subject, order_number, status, source_channel, received_at, is_angry, needs_human')
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

      <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <p className="text-xs text-gray-400">{(inquiries ?? []).length} 件</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {(inquiries ?? []).length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">
            該当する問い合わせはありません
          </p>
        ) : (
          (inquiries ?? []).map((inq) => (
            <Link
              key={inq.id}
              href={buildUrl(`/inbox/${inq.id}`, {
                status: currentStatus,
                channel: channel || undefined,
                tag: tagId,
                q,
                mine: mine ? '1' : undefined,
              })}
              className={`block px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedId === inq.id
                  ? 'bg-blue-50 border-l-2 border-l-blue-500 pl-2.5'
                  : ''
              }`}
            >
              <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                {inq.is_angry && (
                  <span className="text-xs bg-red-500 text-white rounded px-1.5 py-0.5 font-semibold">🔥 要注意</span>
                )}
                {inq.needs_human && (
                  <span className="text-xs bg-orange-500 text-white rounded px-1.5 py-0.5 font-semibold">⚠ 要対応</span>
                )}
                {inq.source_channel && (() => {
                  const ch = channelMeta[inq.source_channel] ?? { label: inq.source_channel, className: 'bg-gray-100 text-gray-500' }
                  return <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${ch.className}`}>{ch.label}</span>
                })()}
              </div>
              <p className="text-sm font-medium text-gray-900 truncate">
                {inq.customer_name ?? '（名前なし）'}
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {inq.subject ?? '（件名なし）'}
              </p>
              {inq.order_number && (
                <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                  {inq.order_number}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {new Date(inq.received_at).toLocaleString('ja-JP', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

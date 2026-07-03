import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ListPanel } from '@/components/inbox/ListPanel'
import { InquiryListPanel } from '@/components/inbox/InquiryListPanel'
import { StatusSelect } from './StatusSelect'
import { AssigneeSelect } from './AssigneeSelect'
import { CommentForm } from './CommentForm'
import { AiDraftSection } from './AiDraftSection'
import { TagsSection } from './TagsSection'
import { QuickStatusBar } from './QuickStatusBar'
import { ReplyForm } from './ReplyForm'
import { CustomerLinkSection } from './CustomerLinkSection'
import { ShippingStatusSection } from './ShippingStatusSection'
import type { ShippingOrderData } from './ShippingStatusSection'
import { getCustomerLinkCandidates, getCustomerInquiryHistory } from '@/lib/customer-queries'
import type { InquiryStatus, DbUser, DbInquiry, DbTag, DbCustomerProfile } from '@/lib/types'
import { channelMeta } from '@/lib/channel-meta'

type UserOption = Pick<DbUser, 'id' | 'display_name'>

type InquiryDetail = DbInquiry & {
  assignee: { id: string; display_name: string; avatar_url: string | null } | null
  mall: { id: string; code: string; name: string } | null
  lock_holder: { id: string; display_name: string } | null
  customer_profile: Pick<DbCustomerProfile, 'id' | 'display_name' | 'customer_name' | 'primary_email' | 'customer_email' | 'order_count' | 'inquiry_count' | 'return_count'> | null
}

type MessageRow = {
  id: string
  direction: string
  is_ai_draft: boolean
  body: string
  sent_at: string
  sender: { display_name: string } | null
}

type CommentRow = {
  id: string
  body: string
  created_at: string
  author: { display_name: string } | null
}

type LogRow = {
  id: string
  action: string
  created_at: string
  after_val: Record<string, unknown> | null
  actor: { display_name: string } | null
}

type AiLogRow = {
  id: string
  result: Record<string, unknown> | null
  feedback: string | null
}

type InquiryTagRow = {
  tag_id: string
}

const STATUS_LABELS: Record<InquiryStatus, string> = {
  open: '未対応',
  pending: '保留中',
  resolved: '解決済み',
  spam: 'スパム',
}

const ACTION_LABELS: Record<string, string> = {
  assigned: '担当者を設定',
  replied: '返信',
  status_changed: 'ステータス変更',
  snoozed: 'スヌーズ設定',
  commented: 'コメント追加',
  ai_draft_generated: 'AI返信案を生成',
  ai_draft_accepted: 'AI返信案を採用',
  ai_draft_edited: 'AI返信案を編集',
  knowledge_applied: 'ナレッジを適用',
  tag_added: 'タグを追加',
  tag_removed: 'タグを削除',
  locked: '対応ロックを取得',
  unlocked: '対応ロックを解除',
  lock_expired: 'ロック期限切れ（強制解除）',
  snooze_expired: 'スヌーズ期限到来',
  scheduled_reply: '送信予約',
}

function afterStatus(v: Record<string, unknown> | null): string | null {
  if (!v || typeof v['status'] !== 'string') return null
  return v['status']
}

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; tag?: string; q?: string; mine?: string }> }

export default async function InquiryDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { status, tag: tagId, q, mine: mineParam } = await searchParams
  const currentStatusFromUrl = (status as InquiryStatus | undefined) ?? 'open'
  const mine = mineParam === '1'
  const supabase = await createClient()
  let user
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (e) {
    console.error('[InquiryDetailPage] auth.getUser error:', e)
    redirect('/login')
  }
  if (!user) redirect('/login')

  const { data: rawInquiry } = await supabase
    .from('inquiries')
    .select('*, assignee:assignee_id(id, display_name, avatar_url), mall:mall_id(id, code, name), lock_holder:locked_by(id, display_name), customer_profile:customer_profile_id(id, display_name, customer_name, primary_email, customer_email, order_count, inquiry_count, return_count)')
    .eq('id', id)
    .single()
  if (!rawInquiry) notFound()
  const inq = rawInquiry as unknown as InquiryDetail

  const [
    { data: rawMessages },
    { data: rawComments },
    { data: rawLogs },
    { data: rawUsers },
    { data: rawAiLogs },
    { data: rawInquiryTags },
    { data: rawAllTags },
  ] = await Promise.all([
    supabase.from('inquiry_messages')
      .select('*, sender:sender_id(id, display_name)')
      .eq('inquiry_id', id)
      .order('sent_at', { ascending: true }),
    supabase.from('comments')
      .select('*, author:author_id(id, display_name)')
      .eq('inquiry_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('activity_logs')
      .select('*, actor:actor_id(id, display_name)')
      .eq('inquiry_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('users')
      .select('id, display_name')
      .eq('is_active', true),
    supabase.from('ai_logs')
      .select('id, result, feedback')
      .eq('inquiry_id', id)
      .eq('action_type', 'draft')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('inquiry_tags')
      .select('tag_id')
      .eq('inquiry_id', id),
    supabase.from('tags')
      .select('*')
      .order('name', { ascending: true }),
  ])

  const messages = (rawMessages ?? []) as unknown as MessageRow[]
  const comments = (rawComments ?? []) as unknown as CommentRow[]
  const activityLogs = (rawLogs ?? []) as unknown as LogRow[]
  const users = (rawUsers ?? []) as unknown as UserOption[]
  const latestAiLog = (rawAiLogs ?? [])[0] as unknown as AiLogRow | undefined
  const inquiryTagIds = new Set((rawInquiryTags ?? []).map((r) => (r as unknown as InquiryTagRow).tag_id))
  const allTags = (rawAllTags ?? []) as unknown as DbTag[]
  const currentTags = allTags.filter((t) => inquiryTagIds.has(t.id))

  const currentStatus = inq.status as InquiryStatus

  const LOCK_TIMEOUT_MS = 30 * 60 * 1000
  const lockExpired = inq.locked_at
    ? Date.now() - new Date(inq.locked_at).getTime() > LOCK_TIMEOUT_MS
    : false
  const lockedByOther = !!inq.locked_by && inq.locked_by !== user.id && !lockExpired

  // AI下書きは ai_logs.result.draft から取得（inquiry_messages には保存しない）
  const existingDraft = latestAiLog
    && latestAiLog.feedback !== 'accepted'
    && latestAiLog.feedback !== 'rejected'
    && latestAiLog.result?.draft
    ? { aiLogId: latestAiLog.id, body: latestAiLog.result.draft as string }
    : null

  const linkedProfile = inq.customer_profile ?? null
  const [customerCandidates, customerHistory] = await Promise.all([
    linkedProfile ? Promise.resolve([]) : getCustomerLinkCandidates(id),
    linkedProfile ? getCustomerInquiryHistory(linkedProfile.id, id) : Promise.resolve([]),
  ])

  // 配送状況: order_number 一致を最優先、なければ顧客の最新注文
  const shippingSelect = 'id, order_number, ordered_at, total_amount, shipment_status, carrier, tracking_number, delivery_date, updated_at, items:order_items(item_name, quantity, unit_price)'
  let shippingOrder: ShippingOrderData | null = null

  if (inq.order_number) {
    const { data } = await supabase
      .from('orders')
      .select(shippingSelect)
      .eq('order_number', inq.order_number)
      .order('ordered_at', { ascending: false })
      .limit(1)
    shippingOrder = (data && data.length > 0 ? data[0] : null) as ShippingOrderData | null
  }

  if (!shippingOrder && linkedProfile) {
    const { data } = await supabase
      .from('orders')
      .select(shippingSelect)
      .eq('customer_profile_id', linkedProfile.id)
      .order('ordered_at', { ascending: false })
      .limit(1)
    shippingOrder = (data && data.length > 0 ? data[0] : null) as ShippingOrderData | null
  }

  return (
    <div className="flex h-full overflow-hidden">
      <ListPanel currentStatus={currentStatusFromUrl} tagId={tagId} q={q} mine={mine} />
      <InquiryListPanel currentStatus={currentStatusFromUrl} tagId={tagId} q={q} mine={mine} selectedId={id} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex-shrink-0 bg-white border-b border-gray-200 px-5 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                <span className="text-xs text-gray-400">{inq.mall?.name}</span>
                {inq.inquiry_number && (
                  <span className="text-xs text-gray-300">{inq.inquiry_number}</span>
                )}
              </div>
              <h1 className="text-base font-semibold text-gray-900 truncate">
                {inq.subject ?? '（件名なし）'}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <AssigneeSelect inquiryId={id} currentAssigneeId={inq.assignee_id} users={users} lockedByOther={lockedByOther} />
              <StatusSelect inquiryId={id} currentStatus={currentStatus} />
            </div>
          </div>
        </header>

        <QuickStatusBar inquiryId={id} currentStatus={currentStatus} lockedByOther={lockedByOther} />

        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">内部コメント</h3>
              {comments.length > 0 && (
                <div className="space-y-2 mb-3">
                  {comments.map((c) => (
                    <div key={c.id} className="bg-yellow-50 rounded-lg p-2.5 border border-yellow-100">
                      <p className="text-xs text-gray-800 mb-1.5">{c.body}</p>
                      <p className="text-xs text-gray-400">
                        {c.author?.display_name} · {new Date(c.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <CommentForm inquiryId={id} lockedByOther={lockedByOther} />
            </div>

            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium bg-gray-200 text-gray-600">
                    客
                  </div>
                  <div className="max-w-[65%]">
                    <div className="rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-white border border-gray-200 text-gray-800 rounded-tl-none">
                      {inq.subject ?? '（本文なし）'}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(inq.received_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isInbound = msg.direction === 'inbound'
                  const isAI = msg.is_ai_draft
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isInbound ? '' : 'flex-row-reverse'}`}>
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium ${
                        isInbound ? 'bg-gray-200 text-gray-600' : isAI ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {isInbound ? '客' : isAI ? 'AI' : '担'}
                      </div>
                      <div className="max-w-[65%]">
                        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                          isInbound
                            ? 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                            : isAI
                              ? 'bg-purple-50 border border-purple-200 text-purple-900 rounded-tr-none'
                              : 'bg-blue-500 text-white rounded-tr-none'
                        }`}>
                          {msg.body || '（本文なし）'}
                        </div>
                        <p className={`text-xs text-gray-400 mt-1 ${isInbound ? '' : 'text-right'}`}>
                          {isAI && <span className="text-purple-400 mr-1">AIドラフト</span>}
                          {new Date(msg.sent_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <ReplyForm
            inquiryId={id}
            aiDraftBody={existingDraft?.body}
            currentUserId={user.id}
            initialLockedById={inq.locked_by}
            initialLockedByName={inq.lock_holder?.display_name ?? null}
            initialLockedAt={inq.locked_at}
          />
          </div>

          <aside className="w-72 flex-shrink-0 border-l border-gray-200 overflow-y-auto bg-white divide-y divide-gray-100">
            <section className="p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">タグ</h3>
              <TagsSection inquiryId={id} currentTags={currentTags} allTags={allTags} lockedByOther={lockedByOther} />
            </section>

            <section className="p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">AI返信案</h3>
              <AiDraftSection inquiryId={id} existingDraft={existingDraft} lockedByOther={lockedByOther} />
            </section>

            <section className="p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">関連顧客</h3>
              <CustomerLinkSection
                inquiryId={id}
                linkedProfile={linkedProfile}
                candidates={customerCandidates}
                history={customerHistory}
              />
            </section>

            <section className="p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">配送状況</h3>
              <ShippingStatusSection
                orderNumber={inq.order_number ?? null}
                order={shippingOrder}
              />
            </section>

            <section className="p-4 space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">アクション</h3>
              <div className="bg-gray-50 rounded p-2 text-xs text-gray-400 text-center border border-dashed border-gray-200">送信予約（準備中）</div>
              <div className="bg-gray-50 rounded p-2 text-xs text-gray-400 text-center border border-dashed border-gray-200">スヌーズ（準備中）</div>
            </section>

            <section className="p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">活動ログ</h3>
              <div className="space-y-2.5">
                {activityLogs.map((log) => {
                  const status = afterStatus(log.after_val)
                  return (
                    <div key={log.id} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">{log.actor?.display_name ?? 'システム'}</span>
                          {' が'}{ACTION_LABELS[log.action] ?? log.action}
                          {status && <> → <span className="font-medium">{STATUS_LABELS[status as InquiryStatus] ?? status}</span></>}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(log.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

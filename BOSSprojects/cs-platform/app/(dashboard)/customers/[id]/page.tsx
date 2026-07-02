import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { MemoForm } from './MemoForm'
import { DuplicateCandidatesSection } from './DuplicateCandidatesSection'
import { ActivityTimeline } from './ActivityTimeline'
import { TagSection } from './TagSection'
import type { InquiryStatus, DbCustomerActivityLog } from '@/lib/types'

type DuplicateCandidate = {
  id: string
  display_name: string | null
  customer_name: string | null
  primary_email: string | null
  customer_email: string | null
  phone: string | null
  inquiry_count: number
  reasons: string[]
}

type Props = { params: Promise<{ id: string }> }

const STATUS_LABELS: Record<InquiryStatus, string> = {
  open: '未対応',
  pending: '保留中',
  resolved: '解決済み',
  spam: 'スパム',
}

const STATUS_COLORS: Record<InquiryStatus, string> = {
  open: 'bg-gray-100 text-gray-600',
  pending: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  spam: 'bg-red-100 text-red-600',
}

type InquiryRow = {
  id: string
  received_at: string
  status: string
  subject: string | null
  order_number: string | null
  item_name: string | null
  is_angry: boolean
  needs_human: boolean
  mall: { name: string } | null
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('id, display_name, customer_name, primary_email, customer_email, phone, memo, order_count, inquiry_count, return_count, created_at')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  const { data: rawInquiries } = await supabase
    .from('inquiries')
    .select('id, received_at, status, subject, order_number, item_name, is_angry, needs_human, mall:mall_id(name)')
    .eq('customer_profile_id', id)
    .order('received_at', { ascending: false })

  type OrderItemRow = { item_name: string | null; quantity: number; unit_price: number | null }
  type OrderRow = {
    id: string
    ordered_at: string
    order_number: string | null
    total_amount: number | null
    currency: string
    mall: { name: string } | null
    items: OrderItemRow[]
  }

  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, ordered_at, order_number, total_amount, currency, mall:mall_id(name), items:order_items(item_name, quantity, unit_price)')
    .eq('customer_profile_id', id)
    .order('ordered_at', { ascending: false })
    .limit(20)
  const orders = (ordersData ?? []) as unknown as OrderRow[]

  const [tagsResult, allTagsResult] = await Promise.all([
    supabase
      .from('customer_profile_tags')
      .select('tag_id, tag:customer_tag_definitions(id, name, color)')
      .eq('customer_profile_id', id),
    supabase
      .from('customer_tag_definitions')
      .select('id, name, color')
      .order('name'),
  ])

  type TagDef = { id: string; name: string; color: string }
  type RawTagRow = { tag_id: string; tag: TagDef | null }
  const currentTags: TagDef[] = ((tagsResult.data ?? []) as unknown as RawTagRow[]).flatMap((r) =>
    r.tag ? [r.tag] : []
  )
  const allTags: TagDef[] = (allTagsResult.data ?? []) as TagDef[]

  const name = profile.display_name ?? profile.customer_name ?? '（名前なし）'
  const email = profile.primary_email ?? profile.customer_email
  const rows = (rawInquiries ?? []) as unknown as InquiryRow[]

  // 重複候補検索
  const dupMap = new Map<string, string[]>()
  function addDupReason(profileId: string, reason: string) {
    if (profileId === id) return
    if (!dupMap.has(profileId)) dupMap.set(profileId, [])
    const reasons = dupMap.get(profileId)!
    if (!reasons.includes(reason)) reasons.push(reason)
  }

  const profileName = profile.display_name ?? profile.customer_name
  const profileEmail = profile.primary_email ?? profile.customer_email

  await Promise.all([
    // 名前：完全一致（OR: display_name or customer_name）
    profileName
      ? Promise.resolve(
          supabase
            .from('customer_profiles')
            .select('id')
            .or(`display_name.eq.${profileName},customer_name.eq.${profileName}`)
            .neq('id', id)
        ).then(({ data }) => data?.forEach((r) => addDupReason(r.id, '顧客名が一致')))
      : Promise.resolve(),

    // メール：完全一致
    profileEmail
      ? Promise.resolve(
          supabase
            .from('customer_profiles')
            .select('id')
            .or(`primary_email.eq.${profileEmail},customer_email.eq.${profileEmail}`)
            .neq('id', id)
        ).then(({ data }) => data?.forEach((r) => addDupReason(r.id, 'メールが一致')))
      : Promise.resolve(),

    // 電話：完全一致
    profile.phone
      ? Promise.resolve(
          supabase
            .from('customer_profiles')
            .select('id')
            .eq('phone', profile.phone)
            .neq('id', id)
        ).then(({ data }) => data?.forEach((r) => addDupReason(r.id, '電話番号が一致')))
      : Promise.resolve(),

    // customer_identities：自分の識別子と他プロファイルの識別子が一致
    Promise.resolve(
      supabase
        .from('customer_identities')
        .select('normalized_value')
        .eq('customer_profile_id', id)
    ).then(async ({ data: myIds }) => {
      if (!myIds || myIds.length === 0) return
      const values = myIds.map((r) => r.normalized_value)
      const { data: others } = await supabase
        .from('customer_identities')
        .select('customer_profile_id')
        .in('normalized_value', values)
        .neq('customer_profile_id', id)
      others?.forEach((r) => addDupReason(r.customer_profile_id, '識別子が一致'))
    }),
  ])

  let duplicateCandidates: DuplicateCandidate[] = []
  if (dupMap.size > 0) {
    const { data: dupProfiles } = await supabase
      .from('customer_profiles')
      .select('id, display_name, customer_name, primary_email, customer_email, phone, inquiry_count, memo')
      .in('id', Array.from(dupMap.keys()))

    duplicateCandidates = (dupProfiles ?? [])
      .filter((p) => !p.memo?.includes('[統合済み →'))  // 統合済みは除外
      .map((p) => ({ ...p, reasons: dupMap.get(p.id) ?? [] }))
      .sort((a, b) =>
        b.reasons.length !== a.reasons.length
          ? b.reasons.length - a.reasons.length
          : b.inquiry_count - a.inquiry_count
      )
  }

  const { data: activityLogsRaw } = await supabase
    .from('customer_activity_logs')
    .select('*')
    .eq('customer_profile_id', id)
    .order('created_at', { ascending: false })
    .limit(50)
  const activityLogs = (activityLogsRaw ?? []) as DbCustomerActivityLog[]

  const totalInquiries = rows.length
  const angryCount = rows.filter((r) => r.is_angry).length
  const needsHumanCount = rows.filter((r) => r.needs_human).length
  const openCount = rows.filter((r) => r.status === 'open').length
  const pendingCount = rows.filter((r) => r.status === 'pending').length
  const resolvedCount = rows.filter((r) => r.status === 'resolved').length
  const resolvedRate = totalInquiries > 0 ? Math.round((resolvedCount / totalInquiries) * 100) : 0
  const lastInquiryAt = rows[0]?.received_at ?? null

  const calculatedRiskScore = Math.min(
    angryCount * 0.25
    + needsHumanCount * 0.15
    + profile.return_count * 0.15
    + Math.max(0, totalInquiries - 3) * 0.05,
    1,
  )
  const riskBadge =
    calculatedRiskScore >= 0.70 ? { label: '要注意', className: 'bg-red-100 text-red-700' } :
    calculatedRiskScore >= 0.40 ? { label: '注意', className: 'bg-orange-100 text-orange-700' } :
    { label: '通常', className: 'bg-gray-100 text-gray-500' }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        <div>
          <Link href="/inbox" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← インボックスに戻る
          </Link>
        </div>

        {/* 顧客サマリー */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-semibold text-gray-900">{name}</h1>
                <span className={`text-xs rounded px-2 py-0.5 font-medium ${riskBadge.className}`}>
                  {riskBadge.label}
                </span>
              </div>
              {email && <p className="text-sm text-gray-500">{email}</p>}
              {profile.phone && <p className="text-sm text-gray-500">{profile.phone}</p>}
            </div>
            <div className="flex gap-6 text-center flex-shrink-0">
              <div>
                <p className="text-2xl font-bold text-gray-900">{profile.order_count}</p>
                <p className="text-xs text-gray-400 mt-0.5">注文</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{profile.inquiry_count}</p>
                <p className="text-xs text-gray-400 mt-0.5">問い合わせ</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{profile.return_count}</p>
                <p className="text-xs text-gray-400 mt-0.5">返品</p>
              </div>
            </div>
          </div>

          {/* タグ */}
          <div className="border-t border-gray-100 pt-4 mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">タグ</h2>
            <TagSection customerId={id} currentTags={currentTags} allTags={allTags} />
          </div>

          {/* 問い合わせ傾向 */}
          <div className="border-t border-gray-100 pt-4 mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">問い合わせ傾向</h2>
            {totalInquiries === 0 ? (
              <p className="text-sm text-gray-400">問い合わせ履歴はまだありません</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-gray-50 rounded-md p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-900">{totalInquiries}</p>
                  <p className="text-xs text-gray-400 mt-0.5">総問い合わせ</p>
                </div>
                <div className={`rounded-md p-2.5 text-center ${angryCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-lg font-bold ${angryCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{angryCount}</p>
                  <p className={`text-xs mt-0.5 ${angryCount > 0 ? 'text-red-400' : 'text-gray-400'}`}>要注意</p>
                </div>
                <div className={`rounded-md p-2.5 text-center ${needsHumanCount > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                  <p className={`text-lg font-bold ${needsHumanCount > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{needsHumanCount}</p>
                  <p className={`text-xs mt-0.5 ${needsHumanCount > 0 ? 'text-orange-400' : 'text-gray-400'}`}>人対応</p>
                </div>
                <div className="bg-gray-50 rounded-md p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-900">{resolvedRate}%</p>
                  <p className="text-xs text-gray-400 mt-0.5">解決率</p>
                </div>
                <div className={`rounded-md p-2.5 text-center ${openCount > 0 ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <p className={`text-lg font-bold ${openCount > 0 ? 'text-blue-600' : 'text-gray-900'}`}>{openCount}</p>
                  <p className={`text-xs mt-0.5 ${openCount > 0 ? 'text-blue-400' : 'text-gray-400'}`}>未対応</p>
                </div>
                <div className="bg-gray-50 rounded-md p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-900">{pendingCount}</p>
                  <p className="text-xs text-gray-400 mt-0.5">保留中</p>
                </div>
                <div className="bg-gray-50 rounded-md p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-900">{resolvedCount}</p>
                  <p className="text-xs text-gray-400 mt-0.5">解決済み</p>
                </div>
                <div className="bg-gray-50 rounded-md p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-900">
                    {lastInquiryAt
                      ? new Date(lastInquiryAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
                      : '─'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">最終問い合わせ</p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">メモ</h2>
            <MemoForm customerId={id} initialMemo={profile.memo} />
          </div>
        </div>

        {/* 購入履歴 */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              購入履歴
              {orders.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">{orders.length}件</span>
              )}
            </h2>
          </div>
          {orders.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">購入履歴はありません</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {orders.map((order) => (
                <div key={order.id} className="px-5 py-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(order.ordered_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </span>
                      {order.order_number && (
                        <span className="text-xs text-gray-500 font-mono">{order.order_number}</span>
                      )}
                      {order.mall && (
                        <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{order.mall.name}</span>
                      )}
                    </div>
                    {order.total_amount != null && (
                      <span className="text-sm font-medium text-gray-800 flex-shrink-0">
                        {Number(order.total_amount).toLocaleString('ja-JP')}円
                      </span>
                    )}
                  </div>
                  {order.items.length > 0 && (
                    <div className="space-y-1 pl-2 border-l-2 border-gray-100">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-gray-600">
                          <span className="truncate">{item.item_name ?? '（商品名なし）'}</span>
                          <span className="flex-shrink-0 ml-4 text-gray-400">
                            {item.quantity}点
                            {item.unit_price != null && (
                              <span className="ml-2">{Number(item.unit_price).toLocaleString('ja-JP')}円</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 問い合わせ履歴 */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              問い合わせ履歴
              <span className="ml-2 text-xs font-normal text-gray-400">{rows.length}件</span>
            </h2>
          </div>

          {rows.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">問い合わせ履歴はありません</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {rows.map((inq) => {
                const status = inq.status as InquiryStatus
                return (
                  <Link
                    key={inq.id}
                    href={`/inbox/${inq.id}`}
                    className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-16 text-xs text-gray-400 pt-0.5">
                      {new Date(inq.received_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {inq.is_angry && (
                          <span className="text-xs bg-red-500 text-white rounded px-1 py-0.5 font-semibold leading-none">🔥</span>
                        )}
                        {inq.needs_human && (
                          <span className="text-xs bg-orange-500 text-white rounded px-1 py-0.5 font-semibold leading-none">⚠</span>
                        )}
                        <span className="text-sm text-gray-800 truncate">
                          {inq.subject ?? '（件名なし）'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {inq.mall && <span className="text-xs text-gray-400">{inq.mall.name}</span>}
                        {inq.order_number && (
                          <span className="text-xs text-gray-400 font-mono">{inq.order_number}</span>
                        )}
                        {inq.item_name && (
                          <span className="text-xs text-gray-400 truncate max-w-[160px]">{inq.item_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className={`text-xs rounded px-2 py-0.5 ${STATUS_COLORS[status] ?? STATUS_COLORS.open}`}>
                        {STATUS_LABELS[status] ?? status}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* 重複候補 */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            重複候補
            {duplicateCandidates.length > 0 && (
              <span className="ml-2 text-xs font-normal text-orange-500">{duplicateCandidates.length}件</span>
            )}
          </h2>
          <DuplicateCandidatesSection candidates={duplicateCandidates} targetCustomerId={id} />
        </div>

        {/* 活動履歴 */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            活動履歴
            {activityLogs.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">{activityLogs.length}件</span>
            )}
          </h2>
          <ActivityTimeline logs={activityLogs} />
        </div>

      </div>
    </div>
  )
}

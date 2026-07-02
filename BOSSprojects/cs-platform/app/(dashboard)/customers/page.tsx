import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CustomerFilters } from './CustomerFilters'

type Props = {
  searchParams: Promise<{ q?: string; filter?: string; tag?: string; min_inquiries?: string }>
}

type ProfileRow = {
  id: string
  display_name: string | null
  customer_name: string | null
  primary_email: string | null
  customer_email: string | null
  phone: string | null
  order_count: number
  inquiry_count: number
  return_count: number
  risk_score: number
  created_at: string
}

type TagDef = { id: string; name: string; color: string }

function riskBadge(score: number) {
  if (score >= 0.70) return { label: '要注意', className: 'bg-red-100 text-red-700' }
  if (score >= 0.40) return { label: '注意', className: 'bg-orange-100 text-orange-700' }
  return null
}

export default async function CustomersPage({ searchParams }: Props) {
  const { q, filter, tag, min_inquiries } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // タグ定義（フィルタ UI 用）
  const { data: allTagsData } = await supabase
    .from('customer_tag_definitions')
    .select('id, name, color')
    .order('name')
  const allTags = (allTagsData ?? []) as TagDef[]

  // ---- リレーショナル ID 収集 ----
  // null = 制約なし、Set = 含めるべき ID の集合
  let profileIds: Set<string> | null = null

  function intersect(ids: string[]) {
    profileIds = profileIds === null
      ? new Set(ids)
      : new Set(ids.filter((id) => profileIds!.has(id)))
  }

  // 検索クエリ（各ソースから ID のみ取得 → 最後のクエリに統一）
  if (q) {
    const pattern = `%${q}%`
    const [directRes, identityRes, orderRes] = await Promise.all([
      supabase
        .from('customer_profiles')
        .select('id')
        .or(
          `display_name.ilike.${pattern},customer_name.ilike.${pattern},primary_email.ilike.${pattern},customer_email.ilike.${pattern},phone.ilike.${pattern}`
        ),
      supabase
        .from('customer_identities')
        .select('customer_profile_id')
        .or(`identifier_value.ilike.${pattern},normalized_value.ilike.${pattern}`),
      supabase
        .from('inquiries')
        .select('customer_profile_id')
        .ilike('order_number', pattern)
        .not('customer_profile_id', 'is', null),
    ])
    const ids = new Set<string>()
    directRes.data?.forEach((r) => ids.add(r.id))
    identityRes.data?.forEach((r) => ids.add(r.customer_profile_id))
    orderRes.data?.forEach((r) => r.customer_profile_id && ids.add(r.customer_profile_id))
    intersect(Array.from(ids))
  }

  // needs_human フィルタ
  if (filter === 'needs_human') {
    const { data } = await supabase
      .from('inquiries')
      .select('customer_profile_id')
      .eq('needs_human', true)
      .not('customer_profile_id', 'is', null)
    intersect([...new Set((data ?? []).map((r) => r.customer_profile_id as string))])
  }

  // タグフィルタ
  if (tag) {
    const { data } = await supabase
      .from('customer_profile_tags')
      .select('customer_profile_id')
      .eq('tag_id', tag)
    intersect((data ?? []).map((r) => r.customer_profile_id))
  }

  // ---- 本体取得（1本のクエリに統一）----
  let profiles: ProfileRow[] = []
  const idArray: string[] | null = profileIds !== null ? Array.from(profileIds) : null

  if (idArray === null || idArray.length > 0) {
    let query = supabase
      .from('customer_profiles')
      .select('id, display_name, customer_name, primary_email, customer_email, phone, order_count, inquiry_count, return_count, risk_score, created_at')
      .order('inquiry_count', { ascending: false })
      .order('created_at', { ascending: false })

    if (idArray !== null) {
      query = query.in('id', idArray)
    }
    if (min_inquiries) {
      const n = parseInt(min_inquiries, 10)
      if (!isNaN(n)) query = query.gte('inquiry_count', n)
    }

    const { data } = await query
    profiles = (data ?? []) as ProfileRow[]
  }

  // タグ一括取得（一覧表示用）
  type ProfileTagRow = { customer_profile_id: string; tag: TagDef | null }
  const profileTagMap = new Map<string, TagDef[]>()
  if (profiles.length > 0) {
    const { data: ptData } = await supabase
      .from('customer_profile_tags')
      .select('customer_profile_id, tag:customer_tag_definitions(id, name, color)')
      .in('customer_profile_id', profiles.map((p) => p.id))
    for (const row of (ptData ?? []) as unknown as ProfileTagRow[]) {
      if (!row.tag) continue
      const list = profileTagMap.get(row.customer_profile_id) ?? []
      list.push(row.tag)
      profileTagMap.set(row.customer_profile_id, list)
    }
  }

  const hasFilter = !!(q || filter || tag || min_inquiries)

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        <div>
          <Link href="/inbox" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← インボックスに戻る
          </Link>
        </div>

        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-900">顧客一覧</h1>
          <span className="text-sm text-gray-400">{profiles.length}件</span>
        </div>

        {/* 検索 */}
        <form method="GET">
          {filter && <input type="hidden" name="filter" value={filter} />}
          {tag && <input type="hidden" name="tag" value={tag} />}
          {min_inquiries && <input type="hidden" name="min_inquiries" value={min_inquiries} />}
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="名前・メール・電話・注文番号で検索"
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </form>

        {/* フィルタ */}
        <CustomerFilters
          allTags={allTags}
          currentFilter={filter ?? null}
          currentTag={tag ?? null}
          currentMinInquiries={min_inquiries ?? null}
          q={q ?? null}
        />

        {/* 一覧 */}
        {profiles.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">
            {hasFilter ? '条件に一致する顧客が見つかりません' : '顧客はまだ登録されていません'}
          </p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
            {/* ヘッダー */}
            <div className="grid grid-cols-[1fr_1fr_80px_60px_60px_60px_100px_80px_80px] gap-3 px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <span>顧客名</span>
              <span>メール</span>
              <span>電話</span>
              <span className="text-center">注文</span>
              <span className="text-center">問い合わせ</span>
              <span className="text-center">返品</span>
              <span>タグ</span>
              <span className="text-center">リスク</span>
              <span>作成日</span>
            </div>

            {profiles.map((p) => {
              const name = p.display_name ?? p.customer_name ?? '（名前なし）'
              const email = p.primary_email ?? p.customer_email
              const badge = riskBadge(p.risk_score)
              const tags = profileTagMap.get(p.id) ?? []

              return (
                <Link
                  key={p.id}
                  href={`/customers/${p.id}`}
                  className="grid grid-cols-[1fr_1fr_80px_60px_60px_60px_100px_80px_80px] gap-3 px-4 py-3 hover:bg-gray-50 transition-colors items-center"
                >
                  <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
                  <span className="text-sm text-gray-500 truncate">{email ?? '─'}</span>
                  <span className="text-sm text-gray-500 truncate">{p.phone ?? '─'}</span>
                  <span className="text-sm text-gray-700 text-center">{p.order_count}</span>
                  <span className="text-sm text-gray-700 text-center">{p.inquiry_count}</span>
                  <span className="text-sm text-gray-700 text-center">{p.return_count}</span>
                  <span className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span
                        key={t.id}
                        className="text-xs rounded-full px-1.5 py-0.5 font-medium"
                        style={{ backgroundColor: t.color + '22', color: t.color }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </span>
                  <span className="text-center">
                    {badge ? (
                      <span className={`text-xs rounded px-1.5 py-0.5 ${badge.className}`}>{badge.label}</span>
                    ) : (
                      <span className="text-xs text-gray-300">通常</span>
                    )}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(p.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                  </span>
                </Link>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

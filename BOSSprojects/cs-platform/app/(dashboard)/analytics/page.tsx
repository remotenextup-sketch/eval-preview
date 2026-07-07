import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Link from 'next/link'

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function toYM(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseYM(ym: string): [number, number] {
  const [y, m] = ym.split('-').map(Number)
  return [y, m]
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = parseYM(ym)
  const d = new Date(y, m - 1 + delta, 1)
  return toYM(d)
}

function monthStart(ym: string) {
  const [y, m] = parseYM(ym)
  return new Date(y, m - 1, 1).toISOString()
}

function monthEnd(ym: string) {
  const [y, m] = parseYM(ym)
  return new Date(y, m, 1).toISOString()
}

function monthLabel(ym: string) {
  const [y, m] = parseYM(ym)
  return `${y}年${m}月`
}

const CHANNEL_LABELS: Record<string, string> = {
  all: '全チャネル',
  rakuten: '楽天',
  email: 'メール',
  yahoo: 'Yahoo!',
  line: 'LINE',
  manual: '手動',
}

type InquiryRow = { id: string; source_channel: string | null }

async function fetchMonthData(ym: string, channel: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  let q = supabase
    .from('inquiries')
    .select('id, source_channel')
    .gte('created_at', monthStart(ym))
    .lt('created_at', monthEnd(ym))
    .limit(5000)

  if (channel !== 'all') q = q.eq('source_channel', channel)

  const { data: inquiries } = (await q) as { data: InquiryRow[] | null }
  const ids = (inquiries ?? []).map((i) => i.id)
  if (ids.length === 0) return { inquiries: [], rallyMap: {} as Record<string, number> }

  const rallyMap: Record<string, number> = {}
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300)
    const { data: msgs } = (await supabase
      .from('inquiry_messages')
      .select('inquiry_id')
      .in('inquiry_id', chunk)
      .eq('direction', 'outbound')
      .limit(5000)) as { data: { inquiry_id: string }[] | null }
    for (const msg of msgs ?? []) {
      rallyMap[msg.inquiry_id] = (rallyMap[msg.inquiry_id] ?? 0) + 1
    }
  }

  return { inquiries: inquiries ?? [], rallyMap }
}

const DIST_KEYS = ['0', '1', '2', '3', '4', '5+'] as const

function computeStats(inquiries: InquiryRow[], rallyMap: Record<string, number>) {
  const counts = inquiries.map((i) => rallyMap[i.id] ?? 0)
  const total = counts.length
  if (total === 0) return { total: 0, avg: 0, max: 0, dist: Object.fromEntries(DIST_KEYS.map((k) => [k, 0])) }

  const sum = counts.reduce((a, b) => a + b, 0)
  const dist = Object.fromEntries(DIST_KEYS.map((k) => [k, 0]))
  for (const c of counts) {
    const key = c >= 5 ? '5+' : String(c)
    dist[key]++
  }

  return { total, avg: sum / total, max: Math.max(...counts), dist }
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; channel?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const selectedMonth = params.month ?? toYM(now)
  const channel = params.channel ?? 'all'

  const trendMonths = Array.from({ length: 6 }, (_, i) => shiftMonth(selectedMonth, -(5 - i)))

  const [currentData, ...pastData] = await Promise.all([
    fetchMonthData(selectedMonth, channel),
    ...trendMonths.slice(0, 5).map((ym) => fetchMonthData(ym, channel)),
  ])

  const currentStats = computeStats(currentData.inquiries, currentData.rallyMap)

  const trendData = [
    ...trendMonths.slice(0, 5).map((ym, i) => ({
      ym,
      ...computeStats(pastData[i].inquiries, pastData[i].rallyMap),
    })),
    { ym: selectedMonth, ...currentStats },
  ]

  const isCurrentMonth = selectedMonth === toYM(now)
  const maxDistCount = Math.max(...DIST_KEYS.map((k) => currentStats.dist[k] ?? 0), 1)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-semibold text-gray-900">ラリー回数分析</h1>
        <div className="flex items-center gap-1 text-sm">
          <Link
            href={`/analytics?month=${shiftMonth(selectedMonth, -1)}&channel=${channel}`}
            className="px-2 py-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            ←
          </Link>
          <span className="font-medium text-gray-700 w-24 text-center">{monthLabel(selectedMonth)}</span>
          {isCurrentMonth ? (
            <span className="px-2 py-1 text-gray-200">→</span>
          ) : (
            <Link
              href={`/analytics?month=${shiftMonth(selectedMonth, 1)}&channel=${channel}`}
              className="px-2 py-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              →
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-6">
        {Object.entries(CHANNEL_LABELS).map(([ch, label]) => (
          <Link
            key={ch}
            href={`/analytics?month=${selectedMonth}&channel=${ch}`}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              channel === ch
                ? 'bg-gray-800 text-white border-gray-800'
                : 'text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-7">
        <StatCard label="件数" value={`${currentStats.total.toLocaleString()}件`} />
        <StatCard
          label="平均ラリー"
          value={currentStats.total > 0 ? `${currentStats.avg.toFixed(1)}回` : '─'}
        />
        <StatCard label="最大ラリー" value={currentStats.max > 0 ? `${currentStats.max}回` : '─'} />
      </div>

      {currentStats.total > 0 && (
        <div className="mb-7">
          <p className="text-xs font-medium text-gray-500 mb-3">ラリー分布</p>
          <div className="space-y-1.5">
            {DIST_KEYS.map((key) => {
              const count = currentStats.dist[key] ?? 0
              const pct = ((count / currentStats.total) * 100).toFixed(1)
              const barWidth = (count / maxDistCount) * 100
              return (
                <div key={key} className="flex items-center gap-3 text-xs">
                  <span className="w-14 text-right text-gray-400 flex-shrink-0">
                    {key === '5+' ? '5回以上' : `${key}回`}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-blue-300 rounded-full"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="w-32 text-gray-600 flex-shrink-0">
                    {count.toLocaleString()}件
                    <span className="text-gray-400 ml-1">({pct}%)</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-gray-500 mb-3">月次トレンド（過去6ヶ月）</p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left pb-2 font-normal">月</th>
              <th className="text-right pb-2 font-normal">件数</th>
              <th className="text-right pb-2 font-normal">平均ラリー</th>
              <th className="text-right pb-2 font-normal">最大</th>
            </tr>
          </thead>
          <tbody>
            {trendData.map(({ ym, total, avg, max }) => (
              <tr
                key={ym}
                className={`border-b border-gray-50 ${ym === selectedMonth ? 'bg-blue-50' : ''}`}
              >
                <td className="py-2">
                  <Link
                    href={`/analytics?month=${ym}&channel=${channel}`}
                    className="text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    {monthLabel(ym)}
                  </Link>
                </td>
                <td className="py-2 text-right text-gray-700">{total.toLocaleString()}</td>
                <td className="py-2 text-right text-gray-700">
                  {total > 0 ? `${avg.toFixed(1)}回` : '─'}
                </td>
                <td className="py-2 text-right text-gray-700">{max > 0 ? `${max}回` : '─'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}

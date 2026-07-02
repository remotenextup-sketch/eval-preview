import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ListPanel } from '@/components/inbox/ListPanel'
import { InquiryListPanel } from '@/components/inbox/InquiryListPanel'
import type { InquiryStatus } from '@/lib/types'

type Props = {
  searchParams: Promise<{ status?: string; tag?: string; q?: string; mine?: string; channel?: string }>
}

export default async function InboxPage({ searchParams }: Props) {
  const params = await searchParams
  const currentStatus = (params.status as InquiryStatus) ?? 'open'
  const tagId = params.tag
  const q = params.q
  const mine = params.mine === '1'
  const channel = params.channel

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-full overflow-hidden">
      <ListPanel currentStatus={currentStatus} tagId={tagId} q={q} mine={mine} />
      <InquiryListPanel currentStatus={currentStatus} tagId={tagId} q={q} mine={mine} channel={channel} />
      <main className="flex-1 flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">問い合わせを選択してください</p>
      </main>
    </div>
  )
}

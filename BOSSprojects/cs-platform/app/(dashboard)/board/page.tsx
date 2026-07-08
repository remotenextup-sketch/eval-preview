import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BoardClient } from './BoardClient'
import type { BoardItem, BoardCheck, BoardMember } from './actions'

export default async function BoardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const [{ data: items }, { data: checks }, { data: members }] = await Promise.all([
    db
      .from('shared_board_items')
      .select('id, date, title, content')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    db.from('shared_board_checks').select('item_id, user_id'),
    db.from('users').select('id, display_name').eq('is_active', true).order('display_name', { ascending: true }),
  ])

  return (
    <div className="p-6">
      <BoardClient
        initialItems={(items ?? []) as BoardItem[]}
        initialChecks={(checks ?? []) as BoardCheck[]}
        members={(members ?? []) as BoardMember[]}
        currentUserId={user.id}
      />
    </div>
  )
}

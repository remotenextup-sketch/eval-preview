import { logout } from '@/app/(auth)/login/actions'
import { NavLinks } from './NavLinks'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { HeaderPanel } from './HeaderPanel'
import type { ChecklistItem } from './master/checklist/actions'
import type { BoardItem, BoardCheck, BoardMember } from './board/actions'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  let displayName = ''
  let openCount = 0
  let checklistItems: ChecklistItem[] = []
  let boardItems: BoardItem[] = []
  let boardChecks: BoardCheck[] = []
  let boardMembers: BoardMember[] = []
  let currentUserId: string | null = null

  try {
    const { data: { user } } = await supabase.auth.getUser()
    currentUserId = user?.id ?? null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const [countResult, profileResult, checklistResult, boardItemsResult, boardChecksResult, boardMembersResult] = await Promise.all([
      supabase
        .from('feedback_items')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Open', 'Doing']),
      user
        ? supabase.from('users').select('display_name').eq('id', user.id).single()
        : Promise.resolve({ data: null }),
      db
        .from('checklist_items')
        .select('id, section, title, content, url, display_order')
        .order('section', { ascending: true })
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
      db
        .from('shared_board_items')
        .select('id, date, title, content')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      db.from('shared_board_checks').select('item_id, user_id'),
      db.from('users').select('id, display_name').eq('is_active', true).order('display_name', { ascending: true }),
    ])
    openCount = countResult.count ?? 0
    displayName = profileResult.data?.display_name ?? ''
    checklistItems = checklistResult.data ?? []
    boardItems = boardItemsResult.data ?? []
    boardChecks = boardChecksResult.data ?? []
    boardMembers = boardMembersResult.data ?? []
  } catch {}

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between h-12 px-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-800">CS運営プラットフォーム</span>
          <NavLinks />
          <HeaderPanel
            initialChecklistItems={checklistItems}
            initialBoardItems={boardItems}
            initialBoardChecks={boardChecks}
            boardMembers={boardMembers}
            currentUserId={currentUserId}
          />
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/feedback"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            改善要望
            {openCount > 0 && (
              <span className="bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 text-xs font-medium leading-none">
                {openCount}
              </span>
            )}
          </Link>
          {displayName && (
            <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
              {displayName}
            </span>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              変更
            </button>
          </form>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

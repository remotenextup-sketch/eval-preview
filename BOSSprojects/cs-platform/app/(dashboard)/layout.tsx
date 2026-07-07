import { logout } from '@/app/(auth)/login/actions'
import { NavLinks } from './NavLinks'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  let displayName = ''
  let openCount = 0

  try {
    const { data: { user } } = await supabase.auth.getUser()
    const [countResult, profileResult] = await Promise.all([
      supabase
        .from('feedback_items')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Open', 'Doing']),
      user
        ? supabase.from('users').select('display_name').eq('id', user.id).single()
        : Promise.resolve({ data: null }),
    ])
    openCount = countResult.count ?? 0
    displayName = profileResult.data?.display_name ?? ''
  } catch {}

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between h-12 px-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-800">CS運営プラットフォーム</span>
          <NavLinks />
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

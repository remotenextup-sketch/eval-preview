import { logout } from '@/app/(auth)/login/actions'
import { NavLinks } from './NavLinks'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let openCount = 0
  try {
    const supabase = await createClient()
    const { count } = await supabase
      .from('feedback_items')
      .select('*', { count: 'exact', head: true })
      .in('status', ['Open', 'Doing'])
    openCount = count ?? 0
  } catch {}

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between h-12 px-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-800">CS運営プラットフォーム</span>
          <NavLinks />
        </div>
        <div className="flex items-center gap-4">
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
          <form action={logout}>
            <button type="submit" className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
              ログアウト
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

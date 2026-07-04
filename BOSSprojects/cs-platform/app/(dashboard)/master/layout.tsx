import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MasterNav } from './MasterNav'

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-3 flex items-center gap-6">
        <h1 className="text-sm font-semibold text-gray-700">マスタ管理</h1>
        <MasterNav />
      </div>
      <div className="flex-1 overflow-auto p-6">
        {children}
      </div>
    </div>
  )
}

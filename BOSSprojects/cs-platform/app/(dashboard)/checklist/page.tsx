import { createClient } from '@/lib/supabase/server'
import { ChecklistClient, type ChecklistItem } from '../master/checklist/ChecklistClient'

export default async function ChecklistPage() {
  const supabase = (await createClient()) as any

  const { data } = await supabase
    .from('checklist_items')
    .select('id, section, title, content, url, display_order')
    .order('section', { ascending: true })
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-base font-semibold text-gray-800 mb-5">稼働チェックリスト</h1>
      <ChecklistClient initialItems={(data ?? []) as ChecklistItem[]} />
    </div>
  )
}

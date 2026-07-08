import { createClient } from '@/lib/supabase/server'
import { ChecklistClient, type ChecklistItem } from './ChecklistClient'

export default async function ChecklistPage() {
  const supabase = (await createClient()) as any

  const { data } = await supabase
    .from('checklist_items')
    .select('id, section, title, content, url, display_order')
    .order('section', { ascending: true })
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  return <ChecklistClient initialItems={(data ?? []) as ChecklistItem[]} />
}

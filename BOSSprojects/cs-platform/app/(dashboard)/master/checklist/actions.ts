'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addChecklistItem(
  section: 'pre' | 'post',
  title: string,
  content: string | null,
  url: string | null,
  displayOrder: number,
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any
  const { error } = await supabase.from('checklist_items').insert({
    section,
    title,
    content: content || null,
    url: url || null,
    display_order: displayOrder,
  })
  if (error) return { error: error.message }
  revalidatePath('/master/checklist')
  return {}
}

export async function updateChecklistItem(
  id: string,
  title: string,
  content: string | null,
  url: string | null,
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any
  const { error } = await supabase
    .from('checklist_items')
    .update({ title, content: content || null, url: url || null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/master/checklist')
  return {}
}

export async function deleteChecklistItem(id: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any
  const { error } = await supabase.from('checklist_items').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/master/checklist')
  return {}
}

export async function reorderChecklistItem(
  id: string,
  displayOrder: number,
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any
  const { error } = await supabase
    .from('checklist_items')
    .update({ display_order: displayOrder })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/master/checklist')
  return {}
}

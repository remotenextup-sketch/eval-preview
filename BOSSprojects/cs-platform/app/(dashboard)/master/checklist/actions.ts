'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ChecklistItem = {
  id: string
  section: 'pre' | 'post'
  title: string
  content: string | null
  url: string | null
  display_order: number
}

export async function fetchChecklistItems(): Promise<ChecklistItem[]> {
  const supabase = (await createClient()) as any
  const { data } = await supabase
    .from('checklist_items')
    .select('id, section, title, content, url, display_order')
    .order('section', { ascending: true })
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  return (data ?? []) as ChecklistItem[]
}

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

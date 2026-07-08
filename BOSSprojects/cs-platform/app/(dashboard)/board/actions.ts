'use server'

import { createClient } from '@/lib/supabase/server'

export type BoardItem = {
  id: string
  date: string
  title: string
  content: string | null
}

export type BoardCheck = {
  item_id: string
  user_id: string
}

export type BoardMember = {
  id: string
  display_name: string
}

export async function fetchBoardItemsAndChecks(): Promise<{
  items: BoardItem[]
  checks: BoardCheck[]
}> {
  const supabase = (await createClient()) as any
  const [{ data: items }, { data: checks }] = await Promise.all([
    supabase
      .from('shared_board_items')
      .select('id, date, title, content')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('shared_board_checks').select('item_id, user_id'),
  ])
  return {
    items: (items ?? []) as BoardItem[],
    checks: (checks ?? []) as BoardCheck[],
  }
}

export async function addBoardItem(
  date: string,
  title: string,
  content: string | null,
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any
  const { error } = await supabase
    .from('shared_board_items')
    .insert({ date, title, content: content || null })
  if (error) return { error: error.message }
  return {}
}

export async function updateBoardItem(
  id: string,
  date: string,
  title: string,
  content: string | null,
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any
  const { error } = await supabase
    .from('shared_board_items')
    .update({ date, title, content: content || null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function deleteBoardItem(id: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any
  const { error } = await supabase.from('shared_board_items').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function setBoardCheck(
  itemId: string,
  userId: string,
  checked: boolean,
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any
  if (checked) {
    const { error } = await supabase
      .from('shared_board_checks')
      .upsert({ item_id: itemId, user_id: userId }, { onConflict: 'item_id,user_id' })
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('shared_board_checks')
      .delete()
      .eq('item_id', itemId)
      .eq('user_id', userId)
    if (error) return { error: error.message }
  }
  return {}
}

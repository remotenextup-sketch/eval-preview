'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function logChange(
  db: any,
  tableName: string,
  recordId: string,
  oldValues: object | null,
  newValues: object,
  userId: string,
) {
  await db
    .from('master_change_logs')
    .insert({
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      changed_by: userId,
    })
    .catch(() => {})
}

export async function upsertTemplate(data: {
  id?: string
  template_name: string
  mall?: string
  category?: string
  body: string
  is_active?: boolean
  memo?: string
}): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const now = new Date().toISOString()

  if (data.id) {
    const { data: current, error: fetchErr } = await supabase
      .from('templates')
      .select('*')
      .eq('id', data.id)
      .single()
    if (fetchErr) return { error: fetchErr.message }

    const updates = {
      template_name: data.template_name,
      mall: data.mall ?? null,
      category: data.category ?? null,
      body: data.body,
      is_active: data.is_active ?? true,
      memo: data.memo ?? null,
      updated_at: now,
      updated_by: user.id,
    }

    const { error } = await supabase.from('templates').update(updates).eq('id', data.id)
    if (error) return { error: error.message }

    await logChange(supabase, 'templates', data.id, current, updates, user.id)
  } else {
    const insert = {
      template_name: data.template_name,
      mall: data.mall ?? null,
      category: data.category ?? null,
      body: data.body,
      is_active: data.is_active ?? true,
      memo: data.memo ?? null,
      updated_at: now,
      updated_by: user.id,
      created_by: user.id,
    }

    const { data: inserted, error } = await supabase
      .from('templates')
      .insert(insert)
      .select('id')
      .single()
    if (error) return { error: error.message }

    await logChange(supabase, 'templates', inserted.id, null, insert, user.id)
  }

  revalidatePath('/master/templates')
  return {}
}

export async function toggleTemplate(
  id: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const now = new Date().toISOString()

  const { data: current } = await supabase
    .from('templates')
    .select('is_active')
    .eq('id', id)
    .single()

  const updates = { is_active: isActive, updated_at: now, updated_by: user.id }
  const { error } = await supabase.from('templates').update(updates).eq('id', id)
  if (error) return { error: error.message }

  await logChange(supabase, 'templates', id, current, updates, user.id)

  revalidatePath('/master/templates')
  return {}
}

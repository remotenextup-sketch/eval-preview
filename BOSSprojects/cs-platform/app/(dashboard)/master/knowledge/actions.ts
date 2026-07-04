'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function getKbClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any
}

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

export async function upsertKnowledge(data: {
  id?: string
  product_name?: string
  question?: string
  answer?: string
  reply_body?: string
  reason_category?: string
  source?: string
  confidence?: number | null
  status?: string
  memo?: string
}): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const kb = getKbClient()
  const now = new Date().toISOString()

  if (data.id) {
    const { data: current, error: fetchErr } = await kb
      .from('knowledge_cases')
      .select('*')
      .eq('id', data.id)
      .single()
    if (fetchErr) return { error: fetchErr.message }

    const updates = {
      product_name: data.product_name ?? null,
      question: data.question ?? null,
      answer: data.answer ?? null,
      reply_body: data.reply_body ?? null,
      reason_category: data.reason_category ?? null,
      source: data.source ?? null,
      confidence: data.confidence ?? null,
      status: data.status ?? 'active',
      memo: data.memo ?? null,
      updated_at: now,
      updated_by: user.id,
    }

    const { error } = await kb.from('knowledge_cases').update(updates).eq('id', data.id)
    if (error) return { error: error.message }

    await logChange(supabase, 'knowledge_cases', data.id, current, updates, user.id)
  } else {
    const insert = {
      product_name: data.product_name ?? null,
      question: data.question ?? null,
      answer: data.answer ?? null,
      reply_body: data.reply_body ?? null,
      reason_category: data.reason_category ?? null,
      source: data.source ?? null,
      confidence: data.confidence ?? null,
      status: data.status ?? 'active',
      memo: data.memo ?? null,
      updated_at: now,
      updated_by: user.id,
    }

    const { data: inserted, error } = await kb
      .from('knowledge_cases')
      .insert(insert)
      .select('id')
      .single()
    if (error) return { error: error.message }

    await logChange(supabase, 'knowledge_cases', inserted.id, null, insert, user.id)
  }

  revalidatePath('/master/knowledge')
  return {}
}

export async function toggleKnowledge(
  id: string,
  status: 'active' | 'inactive',
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const kb = getKbClient()
  const now = new Date().toISOString()

  const { data: current } = await kb
    .from('knowledge_cases')
    .select('status')
    .eq('id', id)
    .single()

  const updates = { status, updated_at: now, updated_by: user.id }
  const { error } = await kb.from('knowledge_cases').update(updates).eq('id', id)
  if (error) return { error: error.message }

  await logChange(supabase, 'knowledge_cases', id, current, updates, user.id)

  revalidatePath('/master/knowledge')
  return {}
}

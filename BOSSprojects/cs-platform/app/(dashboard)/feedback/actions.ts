'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export async function createFeedback(formData: FormData) {
  const supabase = (await createClient()) as AnyClient
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const title       = String(formData.get('title')       || '').trim()
  const content     = String(formData.get('content')     || '').trim()
  const category    = String(formData.get('category')    || '要望')
  const priority    = String(formData.get('priority')    || 'Normal')
  const target_page = String(formData.get('target_page') || '').trim() || null

  if (!title || !content) return

  const { data, error } = await supabase
    .from('feedback_items')
    .insert({ title, content, category, priority, target_page, created_by: user.email ?? user.id })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/feedback')
  redirect(`/feedback/${data.id}`)
}

export async function updateStatus(id: string, status: string) {
  const supabase = (await createClient()) as AnyClient
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase
    .from('feedback_items')
    .update({
      status,
      ...(status === 'Done'
        ? { resolved_at: new Date().toISOString() }
        : { resolved_at: null }),
    })
    .eq('id', id)

  revalidatePath(`/feedback/${id}`)
  revalidatePath('/feedback')
}

export async function deleteFeedback(id: string) {
  const supabase = (await createClient()) as AnyClient
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase.from('feedback_items').delete().eq('id', id)

  revalidatePath('/feedback')
  redirect('/feedback')
}

export async function addFeedbackComment(feedbackId: string, body: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as AnyClient
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラー' }
  if (!body.trim()) return { error: '本文が空です' }

  const { error } = await supabase.from('feedback_comments').insert({
    feedback_id: feedbackId,
    author_id: user.id,
    author_email: user.email ?? user.id,
    body: body.trim(),
  })

  if (error) return { error: error.message }

  revalidatePath(`/feedback/${feedbackId}`)
  return {}
}

export async function toggleVote(feedbackId: string) {
  const supabase = (await createClient()) as AnyClient
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: existing } = await supabase
    .from('feedback_votes')
    .select('id')
    .eq('feedback_id', feedbackId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase.from('feedback_votes').delete().eq('id', existing.id)
  } else {
    await supabase.from('feedback_votes').insert({ feedback_id: feedbackId, user_id: user.id })
  }

  revalidatePath(`/feedback/${feedbackId}`)
  revalidatePath('/feedback')
}

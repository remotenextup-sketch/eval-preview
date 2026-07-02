'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateCustomerMemo(
  customerId: string,
  memo: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラー' }

  const { error } = await supabase
    .from('customer_profiles')
    .update({ memo })
    .eq('id', customerId)

  if (error) return { error: error.message }

  revalidatePath(`/customers/${customerId}`)
  return {}
}

export async function addCustomerTag(
  customerId: string,
  tagId: string,
  tagName: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラー' }

  const { error } = await supabase
    .from('customer_profile_tags')
    .insert({ customer_profile_id: customerId, tag_id: tagId, created_by: user.id })

  if (error) return { error: error.message }

  await supabase.from('customer_activity_logs').insert({
    customer_profile_id: customerId,
    actor_id: user.id,
    action: 'tag_added',
    after_val: { tag: tagName, tag_id: tagId },
  })

  revalidatePath(`/customers/${customerId}`)
  revalidatePath('/customers')
  return {}
}

export async function removeCustomerTag(
  customerId: string,
  tagId: string,
  tagName: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラー' }

  const { error } = await supabase
    .from('customer_profile_tags')
    .delete()
    .eq('customer_profile_id', customerId)
    .eq('tag_id', tagId)

  if (error) return { error: error.message }

  await supabase.from('customer_activity_logs').insert({
    customer_profile_id: customerId,
    actor_id: user.id,
    action: 'tag_removed',
    before_val: { tag: tagName, tag_id: tagId },
  })

  revalidatePath(`/customers/${customerId}`)
  revalidatePath('/customers')
  return {}
}

export async function mergeCustomerProfile(
  sourceCustomerId: string,
  targetCustomerId: string,
): Promise<{ error?: string; movedInquiries?: number; movedIdentities?: number }> {
  if (sourceCustomerId === targetCustomerId) return { error: '統合元と統合先が同じです' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラー' }

  const { data, error } = await supabase.rpc('merge_customer_profiles', {
    p_source_customer_id: sourceCustomerId,
    p_target_customer_id: targetCustomerId,
    p_actor_id: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath(`/customers/${targetCustomerId}`)
  revalidatePath(`/customers/${sourceCustomerId}`)
  revalidatePath('/customers')

  const result = data as { moved_inquiries: number; moved_identities: number }
  return { movedInquiries: result.moved_inquiries, movedIdentities: result.moved_identities }
}

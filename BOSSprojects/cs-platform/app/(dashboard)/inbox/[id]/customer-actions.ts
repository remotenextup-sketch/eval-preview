'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SourceChannel, IdentifierType } from '@/lib/types'

export async function linkInquiryToCustomer(
  inquiryId: string,
  customerProfileId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラー' }

  await supabase
    .from('inquiries')
    .update({ customer_profile_id: customerProfileId })
    .eq('id', inquiryId)

  await supabase.from('activity_logs').insert({
    inquiry_id: inquiryId,
    actor_id: user.id,
    action: 'customer_linked',
    before_val: null,
    after_val: { customer_profile_id: customerProfileId },
  })

  revalidatePath(`/inbox/${inquiryId}`)
  return {}
}

export async function createCustomerProfileFromInquiry(
  inquiryId: string,
): Promise<{ profileId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラー' }

  const { data: inq } = await supabase
    .from('inquiries')
    .select('customer_name, order_number, source_channel, customer_profile_id')
    .eq('id', inquiryId)
    .single()

  if (!inq) return { error: '問い合わせが見つかりません' }
  if (inq.customer_profile_id) return { error: '既に顧客が紐づいています' }

  const { data: profile } = await supabase
    .from('customer_profiles')
    .insert({
      display_name: inq.customer_name,
      customer_name: inq.customer_name,
    })
    .select('id')
    .single()

  if (!profile) return { error: 'プロフィール作成に失敗しました' }

  const channel: SourceChannel = inq.source_channel ?? 'manual'
  const identities: Array<{
    customer_profile_id: string
    channel: SourceChannel
    identifier_type: IdentifierType
    identifier_value: string
    normalized_value: string
    confidence: number
    source_inquiry_id: string
  }> = []

  if (inq.order_number) {
    identities.push({
      customer_profile_id: profile.id,
      channel,
      identifier_type: 'order_number',
      identifier_value: inq.order_number,
      normalized_value: inq.order_number,
      confidence: 1.00,
      source_inquiry_id: inquiryId,
    })
  }

  if (inq.customer_name) {
    identities.push({
      customer_profile_id: profile.id,
      channel,
      identifier_type: 'name',
      identifier_value: inq.customer_name,
      normalized_value: inq.customer_name,
      confidence: 0.70,
      source_inquiry_id: inquiryId,
    })
  }

  if (identities.length > 0) {
    await supabase.from('customer_identities').insert(identities)
  }

  await supabase
    .from('inquiries')
    .update({ customer_profile_id: profile.id })
    .eq('id', inquiryId)

  await supabase.from('activity_logs').insert({
    inquiry_id: inquiryId,
    actor_id: user.id,
    action: 'customer_profile_created',
    before_val: null,
    after_val: { customer_profile_id: profile.id },
  })

  revalidatePath(`/inbox/${inquiryId}`)
  return { profileId: profile.id }
}

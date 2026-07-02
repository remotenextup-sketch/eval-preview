import { createClient } from '@/lib/supabase/server'
import type { DbCustomerProfile } from '@/lib/types'

export type InquiryHistoryItem = {
  id: string
  received_at: string
  status: string
  subject: string | null
  order_number: string | null
  is_angry: boolean
  needs_human: boolean
}

export type CustomerCandidate = {
  profile: Pick<DbCustomerProfile, 'id' | 'display_name' | 'customer_name' | 'primary_email' | 'customer_email' | 'order_count' | 'inquiry_count'>
  reasons: string[]
}

const REASON_LABELS: Record<string, string> = {
  order_number: '注文番号が一致',
  email: 'メールアドレスが一致',
  masked_email: '楽天マスクアドレスが一致',
  line_user_id: 'LINE IDが一致',
  phone: '電話番号が一致',
  name: '顧客名が一致',
}

export async function getCustomerLinkCandidates(inquiryId: string): Promise<CustomerCandidate[]> {
  const supabase = await createClient()

  const { data: inq } = await supabase
    .from('inquiries')
    .select('order_number, customer_name, external_customer_key, source_channel, customer_profile_id')
    .eq('id', inquiryId)
    .single()

  if (!inq || inq.customer_profile_id) return []

  const profileReasons = new Map<string, string[]>()

  function addReason(profileId: string, type: string) {
    if (!profileReasons.has(profileId)) profileReasons.set(profileId, [])
    const reasons = profileReasons.get(profileId)!
    const label = REASON_LABELS[type] ?? type
    if (!reasons.includes(label)) reasons.push(label)
  }

  const queries: Promise<void>[] = []

  if (inq.order_number) {
    queries.push(
      Promise.resolve(
        supabase
          .from('customer_identities')
          .select('customer_profile_id')
          .eq('identifier_type', 'order_number')
          .eq('normalized_value', inq.order_number)
      ).then(({ data }) => {
        data?.forEach((r) => addReason(r.customer_profile_id, 'order_number'))
      })
    )
  }

  if (inq.customer_name) {
    queries.push(
      Promise.resolve(
        supabase
          .from('customer_identities')
          .select('customer_profile_id')
          .eq('identifier_type', 'name')
          .eq('normalized_value', inq.customer_name)
      ).then(({ data }) => {
        data?.forEach((r) => addReason(r.customer_profile_id, 'name'))
      })
    )
  }

  if (inq.external_customer_key) {
    queries.push(
      Promise.resolve(
        supabase
          .from('customer_identities')
          .select('customer_profile_id, identifier_type')
          .eq('normalized_value', inq.external_customer_key)
      ).then(({ data }) => {
        data?.forEach((r) => addReason(r.customer_profile_id, r.identifier_type))
      })
    )
  }

  await Promise.all(queries)

  if (profileReasons.size === 0) return []

  const profileIds = Array.from(profileReasons.keys())
  const { data: profiles } = await supabase
    .from('customer_profiles')
    .select('id, display_name, customer_name, primary_email, customer_email, order_count, inquiry_count')
    .in('id', profileIds)

  if (!profiles) return []

  return profiles
    .map((p) => ({
      profile: p,
      reasons: profileReasons.get(p.id) ?? [],
    }))
    .sort((a, b) => b.reasons.length - a.reasons.length)
}

export async function getCustomerInquiryHistory(
  customerProfileId: string,
  currentInquiryId: string,
): Promise<InquiryHistoryItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('inquiries')
    .select('id, received_at, status, subject, order_number, is_angry, needs_human')
    .eq('customer_profile_id', customerProfileId)
    .neq('id', currentInquiryId)
    .order('received_at', { ascending: false })
    .limit(5)
  return (data ?? []) as InquiryHistoryItem[]
}

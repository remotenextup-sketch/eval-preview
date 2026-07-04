import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { KnowledgeClient } from './KnowledgeClient'

export default async function KnowledgePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const kb = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any

  const { data: cases } = await kb
    .from('knowledge_cases')
    .select(
      'id, product_name, question, reply_body, reason_category, source, confidence, status, memo, updated_at',
    )
    .order('updated_at', { ascending: false })
    .limit(500)

  return <KnowledgeClient cases={cases ?? []} />
}

import { createClient } from '@supabase/supabase-js'
import { LoginClient } from './LoginClient'

export default async function LoginPage() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await db
    .from('users')
    .select('id, display_name, email')
    .eq('is_active', true)
    .ilike('email', '%@cs.local')
    .order('display_name', { ascending: true })

  return <LoginClient members={data ?? []} />
}

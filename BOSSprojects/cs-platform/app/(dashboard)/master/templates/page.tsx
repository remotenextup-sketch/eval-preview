import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TemplatesClient } from './TemplatesClient'

export default async function TemplatesPage() {
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: templates } = await supabase
    .from('templates')
    .select('id, template_name, mall, category, body, is_active, memo, updated_at')
    .order('template_name', { ascending: true })

  return <TemplatesClient templates={templates ?? []} />
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

// サービスロールキーでRLSをバイパス（Cron専用。ユーザーセッション不要）
function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(request: Request) {
  const auth = request.headers.get('Authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const { data: targets, error } = await supabase
    .from('inquiries')
    .select('id')
    .eq('status', 'pending')
    .lte('snooze_until', now)
    .not('snooze_until', 'is', null)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  if (!targets || targets.length === 0) {
    return NextResponse.json({ success: true, processed: 0 })
  }

  const ids = targets.map((r) => r.id)

  const { error: updateError } = await supabase
    .from('inquiries')
    .update({ status: 'open', snooze_until: null })
    .in('id', ids)

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
  }

  const logs = ids.map((id) => ({
    inquiry_id: id,
    actor_id: null as string | null,
    action: 'snooze_expired' as const,
    before_val: { status: 'pending' } as Record<string, unknown>,
    after_val: { from: 'pending', to: 'open' } as Record<string, unknown>,
  }))

  await supabase.from('activity_logs').insert(logs)

  return NextResponse.json({ success: true, processed: ids.length })
}

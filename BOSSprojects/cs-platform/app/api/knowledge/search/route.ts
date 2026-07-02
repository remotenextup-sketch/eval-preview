export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const configuredKey = process.env.CS_INTAKE_API_KEY?.trim()
  if (configuredKey) {
    const providedKey = req.headers.get('x-api-key')?.trim()
    if (providedKey !== configuredKey) {
      return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
    }
  }

  try {
    const body = await req.json()
    const { query, category, limit: limitRaw } = body

    const limit = Math.min(limitRaw ?? 5, 10)

    const supabase = createServiceClient()

    let q = supabase.from('knowledge').select('*').eq('is_active', true)

    if (category) {
      q = q.eq('category', category)
    }

    if (query) {
      q = q.or(
        `title.ilike.%${query}%,question_pattern.ilike.%${query}%,answer_template.ilike.%${query}%`
      )
    }

    const { data: items, error } = await q.order('quality_score', { ascending: false }).limit(limit)

    if (error) {
      return NextResponse.json(
        { ok: false, reason: 'query_failed', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, items: items ?? [] })
  } catch (e: unknown) {
    console.error('[knowledge/search]', e)
    const msg = e instanceof Error ? e.message : 'unknown_error'
    return NextResponse.json(
      { ok: false, reason: 'internal_error', message: msg },
      { status: 500 }
    )
  }
}

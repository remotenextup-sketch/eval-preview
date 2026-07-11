export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  // 認証チェック
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  if (!path) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 })
  }

  const proxyUrl = process.env.BOSS_API_PROXY_URL
  const proxyKey = process.env.BOSS_PROXY_API_KEY
  if (!proxyUrl) {
    return NextResponse.json({ error: 'BOSS_API_PROXY_URL not set' }, { status: 500 })
  }

  const url = `${proxyUrl}/api/boss/inquiry/attachment?path=${encodeURIComponent(path)}`
  const res = await fetch(url, {
    headers: {
      ...(proxyKey ? { 'x-api-key': proxyKey } : {}),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    return NextResponse.json({ error: `Proxy returned ${res.status}` }, { status: 502 })
  }

  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  const buffer = await res.arrayBuffer()

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

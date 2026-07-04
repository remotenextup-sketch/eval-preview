import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  let body: {
    room_id: string
    room_name: string
    message: string
    inquiry_id?: string
    source_type: string
    mall?: string
    mentioned_account_ids: string[]
    mentioned_names: string[]
    comment: string
    shared_body: string
    source_url: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
  }

  const {
    room_id,
    room_name,
    message,
    inquiry_id,
    source_type,
    mall,
    mentioned_account_ids,
    mentioned_names,
    comment,
    shared_body,
    source_url,
  } = body

  if (!room_id || !message) {
    return NextResponse.json({ error: 'room_id と message は必須です' }, { status: 400 })
  }

  // Fetch API token
  const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: settingData, error: settingError } = await db
    .from('chatwork_settings')
    .select('api_token')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (settingError || !settingData?.api_token) {
    return NextResponse.json(
      { error: 'Chatwork APIトークンが設定されていません' },
      { status: 400 },
    )
  }

  const apiToken: string = settingData.api_token

  // POST to Chatwork API
  const formBody = new URLSearchParams({
    body: message,
    self_unread: '0',
  }).toString()

  const cwRes = await fetch(`https://api.chatwork.com/v2/rooms/${room_id}/messages`, {
    method: 'POST',
    headers: {
      'x-chatworktoken': apiToken,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  })

  if (!cwRes.ok) {
    const errText = await cwRes.text().catch(() => '')
    console.error('[chatwork/send] Chatwork API error:', cwRes.status, errText)
    return NextResponse.json(
      { error: `Chatwork APIエラー: ${cwRes.status}` },
      { status: 500 },
    )
  }

  let chatworkMessageId: string | null = null
  try {
    const cwJson = await cwRes.json()
    chatworkMessageId = cwJson.message_id ? String(cwJson.message_id) : null
  } catch {
    // message_id not critical
  }

  // Save to chatwork_shares
  const { error: insertError } = await db.from('chatwork_shares').insert({
    source_type,
    source_id: inquiry_id ?? null,
    inquiry_id: inquiry_id ?? null,
    mall: mall ?? null,
    room_id,
    room_name,
    mentioned_account_ids: mentioned_account_ids ?? [],
    mentioned_names: mentioned_names ?? [],
    comment: comment ?? null,
    shared_body: shared_body ?? null,
    source_url: source_url ?? null,
    chatwork_message_id: chatworkMessageId,
    shared_by: user.id,
  })

  if (insertError) {
    console.error('[chatwork/send] insert error:', insertError)
    // Don't fail the request — the message was sent successfully
  }

  return NextResponse.json({ ok: true, message_id: chatworkMessageId })
}

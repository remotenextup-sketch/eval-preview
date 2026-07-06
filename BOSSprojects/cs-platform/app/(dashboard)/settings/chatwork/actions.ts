'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return { supabase, user: data.user }
}

export async function saveApiToken(token: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await getAuthenticatedUser()
    const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any

    // Delete all existing settings and insert fresh
    await db.from('chatwork_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    const { error } = await db.from('chatwork_settings').insert({
      api_token: token,
      is_active: true,
    })

    if (error) return { error: error.message }

    revalidatePath('/settings/chatwork')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '不明なエラーが発生しました' }
  }
}

export async function upsertRoom(data: {
  id?: string
  room_id: string
  room_name: string
  description?: string
  is_default?: boolean
}): Promise<{ error?: string }> {
  try {
    const { supabase } = await getAuthenticatedUser()
    const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any

    if (data.id) {
      const { error } = await db.from('chatwork_rooms').update({
        room_id: data.room_id,
        room_name: data.room_name,
        description: data.description ?? null,
        is_default: data.is_default ?? false,
        updated_at: new Date().toISOString(),
      }).eq('id', data.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await db.from('chatwork_rooms').insert({
        room_id: data.room_id,
        room_name: data.room_name,
        description: data.description ?? null,
        is_default: data.is_default ?? false,
        is_active: true,
      })
      if (error) return { error: error.message }
    }

    revalidatePath('/settings/chatwork')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '不明なエラーが発生しました' }
  }
}

export async function deleteRoom(id: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await getAuthenticatedUser()
    const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any

    const { error } = await db.from('chatwork_rooms').update({
      is_active: false,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/settings/chatwork')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '不明なエラーが発生しました' }
  }
}

export async function upsertMember(data: {
  id?: string
  account_id: string
  display_name: string
  mention_name?: string
}): Promise<{ error?: string }> {
  try {
    const { supabase } = await getAuthenticatedUser()
    const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any

    if (data.id) {
      const { error } = await db.from('chatwork_members').update({
        account_id: data.account_id,
        display_name: data.display_name,
        mention_name: data.mention_name ?? null,
        updated_at: new Date().toISOString(),
      }).eq('id', data.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await db.from('chatwork_members').insert({
        account_id: data.account_id,
        display_name: data.display_name,
        mention_name: data.mention_name ?? null,
        is_active: true,
      })
      if (error) return { error: error.message }
    }

    revalidatePath('/settings/chatwork')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '不明なエラーが発生しました' }
  }
}

export async function deleteMember(id: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await getAuthenticatedUser()
    const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any

    const { error } = await db.from('chatwork_members').update({
      is_active: false,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/settings/chatwork')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '不明なエラーが発生しました' }
  }
}

export async function setRoomMember(
  roomDbId: string,
  memberDbId: string,
  isDefaultMention: boolean,
): Promise<{ error?: string }> {
  try {
    const { supabase } = await getAuthenticatedUser()
    const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any

    const { error } = await db.from('chatwork_room_members').upsert({
      room_id: roomDbId,
      member_id: memberDbId,
      is_default_mention: isDefaultMention,
    }, { onConflict: 'room_id,member_id' })

    if (error) return { error: error.message }

    revalidatePath('/settings/chatwork')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '不明なエラーが発生しました' }
  }
}

export async function removeRoomMember(
  roomDbId: string,
  memberDbId: string,
): Promise<{ error?: string }> {
  try {
    const { supabase } = await getAuthenticatedUser()
    const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any

    const { error } = await db.from('chatwork_room_members')
      .delete()
      .eq('room_id', roomDbId)
      .eq('member_id', memberDbId)

    if (error) return { error: error.message }

    revalidatePath('/settings/chatwork')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '不明なエラーが発生しました' }
  }
}

export async function syncMembersFromRoom(
  roomDbId: string,
  chatworkRoomId: string,
): Promise<{ error?: string; synced?: number }> {
  try {
    const { supabase } = await getAuthenticatedUser()
    const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any

    const { data: settings } = await db.from('chatwork_settings')
      .select('api_token')
      .order('created_at', { ascending: false })
      .limit(1)
    const token: string | null = settings?.[0]?.api_token ?? null
    if (!token) return { error: 'APIトークンが未設定です' }

    const res = await fetch(`https://api.chatwork.com/v2/rooms/${chatworkRoomId}/members`, {
      headers: { 'X-ChatWorkToken': token },
    })
    if (!res.ok) return { error: `Chatwork API エラー: ${res.status}` }

    const apiMembers: { account_id: number; name: string; chatwork_id?: string }[] = await res.json()

    let synced = 0
    for (const m of apiMembers) {
      const accountId = String(m.account_id)
      const displayName = m.name || `user_${accountId}`

      const { data: existing } = await db.from('chatwork_members')
        .select('id')
        .eq('account_id', accountId)
        .single()

      let memberDbId: string
      if (existing?.id) {
        await db.from('chatwork_members').update({
          display_name: displayName,
          is_active: true,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id)
        memberDbId = existing.id
      } else {
        const { data: inserted } = await db.from('chatwork_members').insert({
          account_id: accountId,
          display_name: displayName,
          is_active: true,
        }).select('id').single()
        if (!inserted?.id) continue
        memberDbId = inserted.id
      }

      await db.from('chatwork_room_members').upsert({
        room_id: roomDbId,
        member_id: memberDbId,
        is_default_mention: false,
      }, { onConflict: 'room_id,member_id' })

      synced++
    }

    revalidatePath('/settings/chatwork')
    return { synced }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '不明なエラーが発生しました' }
  }
}

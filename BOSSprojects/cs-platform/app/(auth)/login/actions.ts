'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function loginAs(email: string): Promise<{ error: string } | undefined> {
  const db = serviceClient()
  const { data: member } = await db.from('users').select('id').eq('email', email).eq('is_active', true).maybeSingle()
  if (!member) return { error: '担当者が見つかりません' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: process.env.CS_SHARED_PASSWORD!,
  })

  if (error) return { error: 'ログインに失敗しました。Supabaseにアカウントが作成されているか確認してください。' }

  revalidatePath('/', 'layout')
  redirect('/inbox')
}

export async function addCsMember(name: string, loginId: string): Promise<{ error?: string }> {
  if (!name.trim()) return { error: '名前を入力してください' }
  if (!loginId.trim()) return { error: 'ログインIDを入力してください' }
  if (!/^[a-z0-9_]+$/.test(loginId.trim())) return { error: 'ログインIDは英小文字・数字・_のみ使用できます' }
  const email = `${loginId.trim()}@cs.local`
  const db = serviceClient()

  const { data: existing } = await db.from('users').select('id, is_active').eq('email', email).maybeSingle()
  if (existing) {
    if (existing.is_active) return { error: 'そのメンバーは既に登録されています' }
    await db.from('users').update({ is_active: true, display_name: name.trim() }).eq('id', existing.id)
    revalidatePath('/login')
    return {}
  }

  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email,
    password: process.env.CS_SHARED_PASSWORD!,
    email_confirm: true,
  })
  if (authErr) return { error: authErr.message }

  await db.from('users').upsert({
    id: authUser.user.id,
    email,
    display_name: name.trim(),
    is_active: true,
  }, { onConflict: 'id' })

  revalidatePath('/login')
  return {}
}

export async function removeCsMember(userId: string): Promise<void> {
  const db = serviceClient()
  await db.from('users').update({ is_active: false }).eq('id', userId)
  revalidatePath('/login')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

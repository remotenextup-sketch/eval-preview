'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CS_MEMBERS } from '@/lib/cs-members'

export async function loginAs(email: string): Promise<{ error: string } | undefined> {
  const member = CS_MEMBERS.find(m => m.email === email)
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

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

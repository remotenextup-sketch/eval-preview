import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatworkSettingsClient } from './ChatworkSettingsClient'

type CwSetting = { id: string; api_token: string | null }
type CwRoom = { id: string; room_id: string; room_name: string; description: string | null; is_default: boolean }
type CwMember = { id: string; account_id: string; display_name: string; mention_name: string | null }
type CwRoomMember = { id: string; room_id: string; member_id: string; is_default_mention: boolean }

export default async function ChatworkSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any

  const [
    { data: rawSettings },
    { data: rawRooms },
    { data: rawMembers },
    { data: rawRoomMembers },
  ] = await Promise.all([
    db.from('chatwork_settings')
      .select('id, api_token')
      .order('created_at', { ascending: false })
      .limit(1),
    db.from('chatwork_rooms')
      .select('id, room_id, room_name, description, is_default')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    db.from('chatwork_members')
      .select('id, account_id, display_name, mention_name')
      .eq('is_active', true)
      .order('display_name', { ascending: true }),
    db.from('chatwork_room_members')
      .select('id, room_id, member_id, is_default_mention'),
  ])

  const setting = ((rawSettings ?? [])[0] as CwSetting | undefined) ?? null
  const rooms = (rawRooms ?? []) as CwRoom[]
  const members = (rawMembers ?? []) as CwMember[]
  const roomMembers = (rawRoomMembers ?? []) as CwRoomMember[]

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Chatwork 設定</h1>
      <ChatworkSettingsClient
        setting={setting}
        rooms={rooms}
        members={members}
        roomMembers={roomMembers}
      />
    </div>
  )
}

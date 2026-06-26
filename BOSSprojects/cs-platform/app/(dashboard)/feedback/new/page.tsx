import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createFeedback } from '../actions'

const TARGET_PAGES = ['Inbox', '詳細画面', '顧客画面', 'AI返信', 'ナレッジ', '分析', 'その他']

export default async function NewFeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-5">
          <Link href="/feedback" className="text-xs text-gray-400 hover:text-gray-600">
            ← 改善バックログ
          </Link>
        </div>

        <h1 className="text-base font-semibold text-gray-900 mb-5">新規追加</h1>

        <form action={createFeedback} className="bg-white border border-gray-200 rounded-md p-5 space-y-4">
          {/* タイトル */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              required
              placeholder="例：受信箱の検索が遅い"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* カテゴリ・優先度 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">カテゴリ</label>
              <select
                name="category"
                defaultValue="要望"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {['改善', 'バグ', '要望', '質問'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">優先度</label>
              <select
                name="priority"
                defaultValue="Normal"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {['High', 'Normal', 'Low'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 対象画面 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">対象画面</label>
            <select
              name="target_page"
              defaultValue=""
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">未指定</option>
              {TARGET_PAGES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 内容 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              name="content"
              required
              rows={6}
              placeholder="問題・背景・期待する動作などを記載してください"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* 投稿者（表示のみ） */}
          <p className="text-xs text-gray-400">投稿者：{user.email}</p>

          <div className="flex justify-end gap-2 pt-1">
            <Link
              href="/feedback"
              className="text-xs text-gray-500 hover:text-gray-800 px-3 py-2 rounded-md border border-gray-200"
            >
              キャンセル
            </Link>
            <button
              type="submit"
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              追加する
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

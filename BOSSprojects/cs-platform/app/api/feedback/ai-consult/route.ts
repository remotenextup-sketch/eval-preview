export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

// このプロジェクトの修正候補ファイル一覧（Claude に渡すホワイトリスト）
const FILE_CANDIDATES = [
  'app/(dashboard)/feedback/page.tsx',
  'app/(dashboard)/feedback/actions.ts',
  'app/(dashboard)/feedback/[id]/page.tsx',
  'app/(dashboard)/inbox/page.tsx',
  'app/(dashboard)/inbox/[id]/page.tsx',
  'app/(dashboard)/inbox/[id]/actions.ts',
  'app/(dashboard)/inbox/[id]/QuickStatusBar.tsx',
  'app/(dashboard)/inbox/[id]/ReplyForm.tsx',
  'app/(dashboard)/inbox/[id]/AiDraftSection.tsx',
  'app/(dashboard)/customers/[id]/page.tsx',
  'components/inbox/ListPanel.tsx',
  'components/inbox/InquiryListPanel.tsx',
  'app/api/inquiries/intake/route.ts',
  'lib/types.ts',
  'middleware.ts',
]

export type ConsultResultItem = {
  id: string
  title: string
  priority_assessment: '高' | '中' | '低'
  approach: string
  category: 'ui' | 'db' | 'complex'
  fix_files: string[]
}

export type ConsultResult = {
  ok: boolean
  total: number
  items: ConsultResultItem[]
  summary: string
}

export async function POST(req: NextRequest) {
  // ログイン済みユーザーのみ許可
  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 未対応 (Open/Doing) の feedback_items を全件取得
  const { data: items, error } = await supabase
    .from('feedback_items')
    .select('id, title, content, category, priority, status, target_page, created_at')
    .in('status', ['Open', 'Doing'])
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, reason: 'db_error', detail: error.message }, { status: 500 })
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ ok: true, total: 0, items: [], summary: '未対応の案件はありません' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'missing_env',
        message: 'ANTHROPIC_API_KEY が設定されていません。Vercel の Environment Variables または .env.local に追加してください。',
      },
      { status: 500 }
    )
  }

  const client = new Anthropic({ apiKey })

  const itemsText = items.map((i, idx) =>
    `[${idx + 1}] id=${i.id}\n  タイトル: ${i.title}\n  内容: ${i.content ?? ''}\n  カテゴリ: ${i.category}  現在の優先度: ${i.priority}  ステータス: ${i.status}  対象ページ: ${i.target_page ?? 'なし'}`
  ).join('\n\n')

  const prompt = `あなたはNext.js + Supabase構成のCSプラットフォーム（EC顧客対応管理システム）の開発担当AIです。
以下の改善バックログの未対応案件を分析し、各案件について優先度・対応方針・分類・修正候補ファイルを判定してください。

## このプロジェクトの修正候補ファイル一覧
${JSON.stringify(FILE_CANDIDATES, null, 2)}

## 分類基準
- ui: 文言・ラベル変更、表示崩れ、色・レイアウト調整、入力フォーム変更など → 低リスクで自動修正可能
- db: データ保存・取得ロジック、集計計算、フィルタ条件の変更など → PRのみ作成して人間がレビュー
- complex: 認証・権限、複数機能にまたがる変更、要望が曖昧なもの → 手動対応

## 未対応案件（${items.length}件）
${itemsText}

## 出力形式（このJSONのみを返してください。マークダウンのコードブロックは不要です）
{
  "items": [
    {
      "id": "案件のid（元データのid欄をそのままコピー）",
      "priority_assessment": "高|中|低",
      "approach": "対応方針の具体的な説明（100文字以内）",
      "category": "ui|db|complex",
      "fix_files": ["修正候補ファイルパス（上記リストから最大3件、なければ空配列）"]
    }
  ],
  "summary": "全体の傾向・優先して取り組むべき内容のまとめ（200文字以内）"
}`

  let result: { items: ConsultResultItem[]; summary: string }
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = (message.content[0] as { type: string; text: string }).text
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    result = JSON.parse(jsonMatch?.[0] ?? rawText)
  } catch (e) {
    console.error('[ai-consult] Claude API or parse error', e)
    return NextResponse.json({ ok: false, reason: 'ai_error', detail: String(e) }, { status: 500 })
  }

  // タイトルを result に補完（UI表示用）
  const titleMap = Object.fromEntries(items.map(i => [i.id, i.title]))
  result.items = result.items.map(i => ({ ...i, title: titleMap[i.id] ?? i.title ?? '' }))

  // Chatwork 通知（設定されていれば）
  await sendChatwork(result, items.length).catch(e =>
    console.error('[ai-consult] chatwork error', e)
  )

  return NextResponse.json({ ok: true, total: items.length, ...result } satisfies ConsultResult)
}

async function sendChatwork(
  result: { items: ConsultResultItem[]; summary: string },
  total: number
) {
  const token = process.env.CHATWORK_API_TOKEN
  const roomId = process.env.CHATWORK_ROOM_ID
  if (!token || !roomId) return

  const byPriority = (p: '高' | '中' | '低') =>
    result.items.filter(i => i.priority_assessment === p)

  const formatBlock = (items: ConsultResultItem[]) =>
    items
      .map(i => {
        const files = i.fix_files.length > 0 ? `\n    修正候補: ${i.fix_files.join(', ')}` : ''
        return `・[${i.category.toUpperCase()}] ${i.title}\n    → ${i.approach}${files}`
      })
      .join('\n')

  const high = byPriority('高')
  const mid  = byPriority('中')
  const low  = byPriority('低')

  let body = `[info][title]🤖 改善バックログ AIレポート[/title]`
  body += `未対応 ${total}件 を分析しました。\n\n`
  body += `■ まとめ\n${result.summary}\n`
  if (high.length > 0) body += `\n■ 優先度：高（${high.length}件）\n${formatBlock(high)}\n`
  if (mid.length  > 0) body += `\n■ 優先度：中（${mid.length}件）\n${formatBlock(mid)}\n`
  if (low.length  > 0) body += `\n■ 優先度：低（${low.length}件）\n${formatBlock(low)}`
  body += `[/info]`

  const res = await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: {
      'x-chatworktoken': token,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `body=${encodeURIComponent(body)}`,
  })
  if (!res.ok) {
    console.error('[ai-consult] chatwork response', res.status, await res.text())
  }
}

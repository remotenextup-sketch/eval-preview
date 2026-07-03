import type { DbCustomerActivityLog } from '@/lib/types'

const ACTION_LABELS: Record<string, string> = {
  customer_merged: '顧客統合',
  memo_updated: 'メモ更新',
  tag_added: 'タグ追加',
  tag_removed: 'タグ削除',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function LogDetail({ log }: { log: DbCustomerActivityLog }) {
  if (log.action === 'customer_merged') {
    const before = log.before_val as Record<string, unknown> | null
    const after = log.after_val as Record<string, unknown> | null
    const sourceId = before?.source_customer_id as string | undefined
    const movedInquiries = after?.moved_inquiries as number | undefined
    return (
      <div className="text-xs text-gray-500 space-y-0.5 mt-1">
        {sourceId && <p>統合元: <span className="font-mono">{sourceId}</span></p>}
        {movedInquiries !== undefined && <p>移動問い合わせ: {movedInquiries}件</p>}
      </div>
    )
  }

  if (log.action === 'tag_added' || log.action === 'tag_removed') {
    const after = log.after_val as Record<string, unknown> | null
    const before = log.before_val as Record<string, unknown> | null
    const tag = (after?.tag ?? before?.tag) as string | undefined
    return tag ? <p className="text-xs text-gray-500 mt-1">{tag}</p> : null
  }

  return null
}

type Props = {
  logs: DbCustomerActivityLog[]
}

export function ActivityTimeline({ logs }: Props) {
  if (logs.length === 0) {
    return <p className="text-sm text-gray-400">活動履歴はまだありません</p>
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="bg-white border border-gray-200 rounded-md px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">
                {ACTION_LABELS[log.action] ?? log.action}
              </p>
              <LogDetail log={log} />
            </div>
            <p className="text-xs text-gray-400 flex-shrink-0 pt-0.5">
              {formatDate(log.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

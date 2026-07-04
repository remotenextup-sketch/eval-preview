type CwShare = {
  id: string
  room_name: string | null
  mentioned_names: string[] | null
  comment: string | null
  created_at: string
}

type Props = { shares: CwShare[] }

export function ChatworkShareHistory({ shares }: Props) {
  if (shares.length === 0) {
    return <p className="text-xs text-gray-400">共有履歴なし</p>
  }

  return (
    <div className="space-y-2">
      {shares.map(share => {
        const mentionText = share.mentioned_names && share.mentioned_names.length > 0
          ? share.mentioned_names.join(', ')
          : null
        const commentText = share.comment
          ? share.comment.length > 50
            ? share.comment.slice(0, 50) + '...'
            : share.comment
          : null
        const dateText = new Date(share.created_at).toLocaleString('ja-JP', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })

        return (
          <div key={share.id} className="bg-gray-50 rounded-md p-2.5 border border-gray-100">
            {share.room_name && (
              <p className="text-xs font-medium text-gray-800">{share.room_name}</p>
            )}
            {mentionText && (
              <p className="text-xs text-gray-500 mt-0.5">{mentionText}</p>
            )}
            {commentText && (
              <p className="text-xs text-gray-600 mt-0.5">{commentText}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{dateText}</p>
          </div>
        )
      })}
    </div>
  )
}

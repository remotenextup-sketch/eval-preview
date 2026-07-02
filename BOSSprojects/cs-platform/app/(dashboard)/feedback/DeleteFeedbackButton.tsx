'use client'

export function DeleteFeedbackButton() {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm('このアイテムを削除しますか？')) e.preventDefault()
      }}
      className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-md px-3 py-1.5 transition-colors"
    >
      削除
    </button>
  )
}

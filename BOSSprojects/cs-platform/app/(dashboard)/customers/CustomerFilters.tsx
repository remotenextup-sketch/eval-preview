'use client'

import { useRouter, usePathname } from 'next/navigation'

type TagDef = { id: string; name: string; color: string }

type Props = {
  allTags: TagDef[]
  currentFilter: string | null
  currentTag: string | null
  currentMinInquiries: string | null
  q: string | null
}

export function CustomerFilters({ allTags, currentFilter, currentTag, currentMinInquiries, q }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  // フィルタは排他選択。クリックで1つだけセット、再クリックで解除
  function select(key: string, value: string) {
    const current =
      key === 'filter' ? currentFilter :
      key === 'tag' ? currentTag :
      currentMinInquiries
    const next = current === value ? null : value
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (next) params.set(key, next)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const baseChip = 'text-xs px-2.5 py-1 rounded-full border transition-colors'
  const inactiveChip = 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => select('filter', 'needs_human')}
        className={`${baseChip} ${currentFilter === 'needs_human' ? 'bg-orange-100 text-orange-700 border-orange-200' : inactiveChip}`}
      >
        人対応あり
      </button>
      <button
        onClick={() => select('min_inquiries', '5')}
        className={`${baseChip} ${currentMinInquiries === '5' ? 'bg-gray-800 text-white border-gray-800' : inactiveChip}`}
      >
        問い合わせ5件以上
      </button>
      {allTags.map((tag) => {
        const isActive = currentTag === tag.id
        return (
          <button
            key={tag.id}
            onClick={() => select('tag', tag.id)}
            className={`${baseChip} flex items-center gap-1.5 ${isActive ? '' : inactiveChip}`}
            style={
              isActive
                ? { backgroundColor: tag.color + '22', color: tag.color, borderColor: tag.color }
                : undefined
            }
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            {tag.name}
          </button>
        )
      })}
    </div>
  )
}

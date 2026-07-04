'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/master/products', label: '商品マスタ' },
  { href: '/master/knowledge', label: 'ナレッジ事例' },
  { href: '/master/templates', label: '返信テンプレ' },
]

export function MasterNav() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-1">
      {TABS.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={`text-sm px-3 py-1 rounded-md transition-colors ${
              isActive
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

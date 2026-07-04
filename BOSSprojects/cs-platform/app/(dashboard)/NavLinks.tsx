'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { label: '受信箱', href: '/inbox' },
  { label: '顧客', href: '/customers' },
  { label: '対応履歴', href: '/support-actions' },
  { label: 'マスタ', href: '/master/products' },
  { label: '設定', href: '/settings/chatwork' },
]

export function NavLinks() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map(({ label, href }) => {
        const matchBase = href === '/master/products' ? '/master' : href
        const isActive = pathname === href || pathname.startsWith(`${matchBase}/`) || (href === '/master/products' && pathname === '/master')
        return (
          <Link
            key={href}
            href={href}
            className={`text-sm px-3 py-1 rounded-md transition-colors ${
              isActive
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

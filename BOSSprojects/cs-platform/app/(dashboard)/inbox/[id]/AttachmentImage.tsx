'use client'

import { useState } from 'react'

type Props = {
  src: string
  label: string
}

export function AttachmentImage({ src, label }: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-blue-600 underline bg-gray-50 border border-gray-200 rounded px-2 py-1"
      >
        📎 {label}
      </a>
    )
  }

  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        className="max-w-[200px] max-h-[200px] rounded-lg border border-gray-200 object-cover"
        onError={() => setFailed(true)}
      />
    </a>
  )
}

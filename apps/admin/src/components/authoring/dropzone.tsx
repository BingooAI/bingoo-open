// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useCallback, useRef, useState, type DragEvent } from 'react'
import { FileText, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Vùng kéo-thả file (mặc định PDF). Click cũng mở được hộp chọn file. */
export function Dropzone({
  file,
  onFile,
  accept = 'application/pdf',
  label,
  hint,
  disabled,
}: {
  file: File | null
  onFile: (f: File | null) => void
  accept?: string
  label: string
  hint?: string
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const take = useCallback(
    (f: File | undefined) => {
      if (!f) return
      if (accept && !f.type.includes(accept.split('/')[1] ?? '')) return
      onFile(f)
    },
    [accept, onFile],
  )

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setOver(false)
    if (disabled) return
    take(e.dataTransfer.files?.[0])
  }

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted px-4 py-3">
        <FileText className="size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{file.name}</div>
          <div className="text-xs text-foreground-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
        </div>
        <button
          type="button"
          onClick={() => onFile(null)}
          disabled={disabled}
          aria-label="Bỏ file"
          className="grid size-8 place-items-center rounded-full text-foreground-muted hover:bg-surface hover:text-foreground disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
        over
          ? 'border-primary bg-primary-soft/40'
          : 'border-border hover:border-primary/60 hover:bg-surface-muted',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <UploadCloud className={cn('size-7', over ? 'text-primary' : 'text-foreground-muted')} />
      <div className="text-sm font-medium text-foreground">{label}</div>
      {hint ? <div className="text-xs text-foreground-muted">{hint}</div> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => take(e.target.files?.[0])}
      />
    </div>
  )
}

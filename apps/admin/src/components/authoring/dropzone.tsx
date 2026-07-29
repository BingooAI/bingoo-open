// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useCallback, useRef, useState, type DragEvent } from 'react'
import { FileText, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Vùng kéo-thả file (mặc định PDF). Click cũng mở được hộp chọn file. */
/**
 * `multiple`: nhận CẢ THƯ MỤC ẢNH, mỗi ảnh một trang sách đã quét.
 *
 * Sách quét không có lớp chữ nên phải đọc bằng ảnh, và một tệp PDF quét thật thì vượt trần dung
 * lượng. Đưa thẳng từng trang là đường ngắn nhất: không tệp nào quá cỡ. THỨ TỰ tệp là thứ tự trang,
 * nên sắp theo tên — trình duyệt không hứa trả về đúng thứ tự người dùng thấy trong thư mục.
 */
export function Dropzone({
  file,
  files,
  onFile,
  onFiles,
  accept = 'application/pdf',
  multiple = false,
  label,
  hint,
  disabled,
}: {
  file?: File | null
  files?: File[]
  onFile?: (f: File | null) => void
  onFiles?: (f: File[]) => void
  accept?: string
  multiple?: boolean
  label: string
  hint?: string
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const take = useCallback(
    (list: FileList | null) => {
      const all = [...(list ?? [])]
      if (all.length === 0) return
      if (multiple) {
        // Thứ tự tệp = thứ tự trang. Trình duyệt không hứa trả về đúng thứ tự thấy trong thư mục,
        // nên sắp theo tên; ảnh quét gần như luôn đánh số trang trong tên.
        const imgs = all
          .filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf')
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        if (imgs.length > 0) onFiles?.(imgs)
        return
      }
      const f = all[0]
      if (!f) return
      if (accept && !f.type.includes(accept.split('/')[1] ?? '')) return
      onFile?.(f)
    },
    [accept, multiple, onFile, onFiles],
  )

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setOver(false)
    if (disabled) return
    take(e.dataTransfer.files)
  }

  // Nhiều tệp: hiện số lượng thay vì tên từng cái — một thư mục 266 ảnh không đọc thành danh sách được.
  if (multiple && files !== undefined && files.length > 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted px-4 py-3">
        <FileText className="size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{files.length} trang</div>
          <div className="truncate text-xs text-foreground-muted">
            {files[0]?.name} … {files[files.length - 1]?.name}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onFiles?.([])}
          disabled={disabled}
          aria-label="Bỏ hết"
          className="grid size-8 place-items-center rounded-full text-foreground-muted hover:bg-surface hover:text-foreground disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
      </div>
    )
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
          onClick={() => onFile?.(null)}
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
        multiple={multiple}
        onChange={(e) => take(e.target.files)}
      />
    </div>
  )
}

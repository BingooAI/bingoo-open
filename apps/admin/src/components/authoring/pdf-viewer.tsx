// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

/**
 * VIEWER PDF — mở đúng TRANG + phủ khung tô đúng DÒNG (rects 0..1 của thẻ truy nguồn).
 *
 * Chỉ nạp qua `dynamic(() => import('./pdf-viewer'), { ssr:false })`: pdf.js đụng DOMMatrix/canvas,
 * KHÔNG được chạy ở RSC/SSR; lazy để nó không vào bundle chính (giáo viên không mở tài liệu thì
 * không tải gì). Worker TỰ-HOST (không CDN — tinh thần R8/CSP). Bytes lấy qua route staff-gated.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { Spinner } from '@bingoo.ai/ui-web'
import * as pdfjs from 'pdfjs-dist'
import type { RectDto } from '@/lib/authoring-queries'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const SCALE = 1.5

export default function PdfViewer({
  documentId,
  page,
  rects,
  onClose,
}: {
  documentId: string
  page: number
  rects: RectDto[]
  onClose: () => void
}) {
  const t = useTranslations('admin.authoring')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  // Tự CUỘN tới dòng đã tô — người duyệt thấy ngay, không phải tìm giữa trang.
  useEffect(() => {
    if (state !== 'ready' || rects.length === 0 || dims.h === 0) return
    const c = scrollRef.current
    const r = rects[0]
    if (!c || !r) return
    c.scrollTo({
      top: Math.max(0, r.y * dims.h - c.clientHeight / 2 + (r.h * dims.h) / 2),
      behavior: 'smooth',
    })
  }, [state, dims, rects])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/authoring/source/${documentId}/file`, { credentials: 'include' })
        if (!res.ok) throw new Error(String(res.status))
        const buf = await res.arrayBuffer()
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
        const pg = await doc.getPage(page)
        const viewport = pg.getViewport({ scale: SCALE })
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx || cancelled) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        await pg.render({ canvasContext: ctx, viewport }).promise
        if (cancelled) return
        setDims({ w: viewport.width, h: viewport.height })
        setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [documentId, page])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={scrollRef}
        className="relative max-h-[90vh] max-w-[92vw] overflow-auto rounded-lg bg-surface p-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-foreground">{t('tbOpenAtPage', { page })}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('tbClose')}
            className="focus-ring shrink-0 rounded p-1 text-foreground-subtle hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {state === 'loading' ? (
          <div className="flex items-center justify-center p-16">
            <Spinner />
          </div>
        ) : null}
        {state === 'error' ? (
          <p className="p-10 text-center text-sm text-foreground-muted">{t('tbViewerFailed')}</p>
        ) : null}

        <div className="relative" style={{ display: state === 'ready' ? 'block' : 'none' }}>
          <canvas ref={canvasRef} className="block rounded" />
          {rects.map((r, i) => (
            <div
              key={i}
              className="pointer-events-none absolute rounded-sm bg-warning/40 ring-2 ring-warning"
              style={{
                left: `${r.x * dims.w}px`,
                top: `${r.y * dims.h}px`,
                width: `${r.w * dims.w}px`,
                height: `${r.h * dims.h}px`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

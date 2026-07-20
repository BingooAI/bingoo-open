// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { UploadCloud } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { Button, Dialog, Field, Input, Progress, Select, useToast } from '@bingoo.ai/ui-web'
import type { MediaKind, MediaVisibility } from '@bingoo.ai/core'
import { ApiError, uploadToSignedUrl } from '@/lib/api-client'
import { useCompleteAsset, useCreateAsset } from '@/lib/media-queries'

const VISIBILITIES: MediaVisibility[] = ['PRIVATE', 'SCOPE', 'PUBLIC']

/** Map a browser MIME type to a MediaKind (server also stores the raw mimeType). */
function kindFromMime(mime: string): MediaKind {
  if (mime.startsWith('image/')) return 'IMAGE'
  if (mime.startsWith('audio/')) return 'AUDIO'
  if (mime.startsWith('video/')) return 'VIDEO'
  if (mime === 'application/pdf' || mime.includes('word') || mime.startsWith('text/')) return 'DOCUMENT'
  if (mime === 'font/ttf' || mime === 'font/otf' || mime.includes('font')) return 'FONT'
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('compressed')) return 'ARCHIVE'
  return 'OTHER'
}

/** Read pixel dimensions of an image file (best-effort; resolves nulls on error). */
function readImageSize(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve({})
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

export function UploadDialog({ folderId }: { folderId: string | null }) {
  const t = useTranslations('admin.upload')
  const tv = useTranslations('admin.visibility')
  const { toast } = useToast()
  const create = useCreateAsset()
  const complete = useCompleteAsset()
  const abortRef = useRef<AbortController | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [visibility, setVisibility] = useState<MediaVisibility>('SCOPE')
  const [progress, setProgress] = useState<number | null>(null)
  const busy = progress !== null

  function reset() {
    setFile(null)
    setTitle('')
    setVisibility('SCOPE')
    setProgress(null)
    abortRef.current = null
  }

  function pick(f: File | null) {
    setFile(f)
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  async function run(close: () => void) {
    if (!file) return
    const kind = kindFromMime(file.type || '')
    const controller = new AbortController()
    abortRef.current = controller
    setProgress(0)
    try {
      // 1) create asset + mint presigned PUT
      const { asset, upload } = await create.mutateAsync({
        kind,
        title: { vi: title.trim() || file.name },
        folderId: folderId ?? undefined,
        visibility,
        mimeType: file.type || undefined,
      })
      // 2) PUT bytes direct to storage (progress reported)
      await uploadToSignedUrl(upload.url, file, {
        contentType: file.type || undefined,
        signal: controller.signal,
        onProgress: (frac) => setProgress(Math.round(frac * 100)),
      })
      // 3) finalize (dimensions for images) → triggers auto-enrich server-side
      const dims = kind === 'IMAGE' ? await readImageSize(file) : {}
      await complete.mutateAsync({
        id: asset.id,
        input: { byteSize: file.size, width: dims.width, height: dims.height },
      })
      toast({ variant: 'success', title: t('done'), description: title || file.name })
      reset()
      close()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setProgress(null)
        return
      }
      setProgress(null)
      toast({
        variant: 'danger',
        title: t('failed'),
        description: err instanceof ApiError ? err.message : undefined,
      })
    }
  }

  return (
    <Dialog
      trigger={
        <span className="inline-flex items-center gap-1.5">
          <UploadCloud className="size-4" />
          {t('button')}
        </span>
      }
      title={t('title')}
      description={t('subtitle')}
      closeAriaLabel={t('cancel')}
      dismissable={!busy}
      footer={(close) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (busy) abortRef.current?.abort()
              reset()
              close()
            }}
          >
            {busy ? t('cancelUpload') : t('cancel')}
          </Button>
          <Button onClick={() => void run(close)} loading={busy} disabled={!file}>
            {t('upload')}
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface-muted px-4 py-8 text-center transition-colors hover:border-primary">
          <UploadCloud className="size-8 text-foreground-subtle" />
          <span className="text-sm font-semibold text-foreground">{file ? file.name : t('dropHint')}</span>
          {file && (
            <span className="text-xs text-foreground-subtle">
              {(file.size / 1024).toFixed(0)} KB · {kindFromMime(file.type || '')}
            </span>
          )}
          <input
            type="file"
            className="sr-only"
            disabled={busy}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>

        <Field label={t('assetTitle')}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
            disabled={busy}
          />
        </Field>

        <Field label={t('visibility')}>
          <Select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as MediaVisibility)}
            disabled={busy}
          >
            {VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {tv(v)}
              </option>
            ))}
          </Select>
        </Field>

        {progress !== null && (
          <div className="space-y-1">
            <Progress value={progress} />
            <p className="text-right text-xs text-foreground-subtle">{progress}%</p>
          </div>
        )}
      </div>
    </Dialog>
  )
}

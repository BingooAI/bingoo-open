// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, useToast } from '@bingoo.ai/ui-web'
import { Check, RefreshCw, Search, Sparkles, X } from 'lucide-react'
import {
  mediaJobAsset,
  useAttachItemMedia,
  useCancelMediaJob,
  useItemMediaSlots,
  useMediaJob,
  useMediaSearch,
  useStartGenAudio,
  useStartGenImage,
  type GenAssetDto,
  type MediaSlotDto,
} from '@/lib/authoring-queries'
import { useAsset } from '@/lib/media-queries'

/**
 * GẮN MEDIA per-item — MỖI Ô RÕ RÀNG (Ảnh cho vật kit · Ảnh minh hoạ · Ảnh/Đọc đáp án A/B/C · Đọc đề).
 * Mỗi ô là một vòng soát: TÌM THƯ VIỆN / SINH MỚI → PREVIEW to → DUYỆT (gắn) / TỪ CHỐI / SINH LẠI.
 * Ảnh-vật kit lưu URL (asUrl) để kit render đúng vật; ô khác lưu assetId.
 */
export function MediaAttach({
  itemKey,
  inv,
}: {
  itemKey: string
  approved?: boolean
  promptText?: string
  inv: { skill?: string; lesson?: string }
}) {
  const t = useTranslations('admin.authoring')
  const slotsQ = useItemMediaSlots(itemKey)
  const slots = slotsQ.data?.slots ?? []
  if (!slots.length) return null
  return (
    <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
        {t('csMedia')}
      </div>
      {slots.map((s) => (
        <SlotRow key={s.path} itemKey={itemKey} slot={s} inv={inv} t={t} />
      ))}
    </div>
  )
}

type Candidate = { assetId: string; url: string | null; title: string }

const assetToCand = (a: GenAssetDto): Candidate => ({
  assetId: a.id,
  url: a.renditions?.find((r) => r.url)?.url ?? null,
  title: a.title?.vi ?? a.title?.en ?? '',
})

function SlotRow({
  itemKey,
  slot,
  inv,
  t,
}: {
  itemKey: string
  slot: MediaSlotDto
  inv: { skill?: string; lesson?: string }
  t: ReturnType<typeof useTranslations>
}) {
  const { toast } = useToast()
  const attach = useAttachItemMedia(inv)
  const startImg = useStartGenImage()
  const startAud = useStartGenAudio()
  const cancelJob = useCancelMediaJob()
  const [cand, setCand] = useState<Candidate | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const isAudio = slot.kind === 'audio'
  const search = useMediaSearch(slot.query, isAudio ? 'audio' : 'image', searchOpen)
  const onErr = (e: unknown) => toast({ variant: 'danger', title: t('failed'), description: String(e) })

  // Sinh media chạy NỀN: POST khởi động → nhận jobId → poll đến khi 'done' rồi lấy asset làm ứng viên.
  const job = useMediaJob(jobId)
  useEffect(() => {
    const s = job.data?.state
    if (!jobId || !s) return
    if (s === 'done') {
      const asset = mediaJobAsset(job.data?.result)
      if (asset) setCand(assetToCand(asset))
      else onErr('no asset')
      setJobId(null)
    } else if (s === 'error') {
      onErr(job.data?.error ?? t('failed'))
      setJobId(null)
    } else if (s === 'cancelled') {
      setJobId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.data?.state, jobId])

  const doGen = () => {
    setSearchOpen(false)
    setCand(null)
    if (isAudio) startAud.mutate({ text: slot.query }, { onSuccess: (j) => setJobId(j.id), onError: onErr })
    else
      startImg.mutate({ prompt: slot.query, count: 1 }, { onSuccess: (j) => setJobId(j.id), onError: onErr })
  }
  const cancelGen = () => {
    if (jobId) cancelJob.mutate(jobId)
    setJobId(null)
  }
  const approve = () => {
    if (!cand) return
    attach.mutate(
      { itemKey, path: slot.path, assetId: cand.assetId, asUrl: slot.asUrl },
      { onSuccess: () => setCand(null), onError: onErr },
    )
  }
  const remove = () =>
    attach.mutate({ itemKey, path: slot.path, assetId: '', asUrl: false }, { onError: onErr })

  const genPending = startImg.isPending || startAud.isPending || Boolean(jobId)
  const busy = genPending || attach.isPending

  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[12px] font-medium text-foreground">
          {isAudio ? '🔊' : '🖼'} {slot.label.vi}
        </span>
        {slot.current && !cand ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-success">
            <Check className="size-3" /> {t('csAttached')}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" disabled={genPending} onClick={() => setSearchOpen((s) => !s)}>
            <Search className="size-3.5" /> {t('csSearchLibrary')}
          </Button>
          <Button size="sm" variant="secondary" loading={busy} onClick={doGen}>
            <Sparkles className="size-3.5" />{' '}
            {genPending ? t('csGenerating') : slot.current || cand ? t('csRegen') : t('csGenerate')}
          </Button>
          {jobId ? (
            <Button size="sm" variant="ghost" onClick={cancelGen}>
              <X className="size-3.5" /> {t('csCancel')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* ỨNG VIÊN đang chờ duyệt (vừa sinh/chọn) → preview to + Duyệt / Từ chối */}
      {cand ? (
        <div className="rounded-md border border-primary/30 bg-primary-soft/5 p-2">
          <Preview kind={slot.kind} url={cand.url} />
          <div className="mt-1.5 flex items-center gap-1.5">
            <Button size="sm" onClick={approve} loading={attach.isPending}>
              <Check className="size-3.5" /> {t('csApprove')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCand(null)}>
              <X className="size-3.5" /> {t('csReject')}
            </Button>
            <Button size="sm" variant="ghost" loading={busy} onClick={doGen}>
              <RefreshCw className="size-3.5" /> {t('csRegen')}
            </Button>
          </div>
        </div>
      ) : slot.current ? (
        /* ĐÃ GẮN → preview to + Bỏ (sinh lại/đổi qua nút trên) */
        <div className="rounded-md border border-success/30 bg-success-soft/10 p-2">
          <AttachedPreview kind={slot.kind} value={slot.current} asUrl={slot.asUrl} />
          <div className="mt-1.5">
            <Button size="sm" variant="ghost" onClick={remove} loading={attach.isPending}>
              <X className="size-3.5" /> {t('csRemoveMedia')}
            </Button>
          </div>
        </div>
      ) : null}

      {/* TÌM THƯ VIỆN → chọn 1 ứng viên */}
      {searchOpen ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {search.isLoading ? (
            <span className="text-[11px] text-foreground-subtle">…</span>
          ) : (search.data?.hits ?? []).length ? (
            (search.data?.hits ?? []).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setCand(assetToCand(a))
                  setSearchOpen(false)
                }}
                title={a.title?.vi ?? a.title?.en ?? a.id}
                className="size-14 overflow-hidden rounded-md border border-border hover:border-primary"
              >
                {a.renditions?.[0]?.url && !isAudio ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.renditions[0].url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-[9px] text-foreground-subtle">
                    {isAudio ? '🔊' : (a.title?.vi ?? a.id).slice(0, 8)}
                  </span>
                )}
              </button>
            ))
          ) : (
            <span className="text-[11px] text-foreground-subtle">{t('csNoHits')}</span>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Preview ứng viên (đã có URL sẵn). */
function Preview({ kind, url }: { kind: 'image' | 'audio'; url: string | null }) {
  if (!url) return <span className="text-[11px] text-foreground-subtle">…</span>
  if (kind === 'audio') return <audio controls src={url} className="h-8 w-full" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="max-h-40 rounded-md object-contain" />
}

/** Preview media ĐÃ GẮN: asUrl → value là URL; else value là assetId (tra thư viện lấy URL). */
function AttachedPreview({ kind, value, asUrl }: { kind: 'image' | 'audio'; value: string; asUrl: boolean }) {
  const asset = useAsset(asUrl ? null : value)
  const url = asUrl ? value : (asset.data?.renditions?.find((r) => r.url)?.url ?? null)
  return <Preview kind={kind} url={url} />
}

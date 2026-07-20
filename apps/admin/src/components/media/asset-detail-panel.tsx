// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { Download, Loader2, Plus, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Combobox,
  Dialog,
  Field,
  Input,
  Select,
  Tag,
  Textarea,
  useToast,
  type ComboboxOption,
} from '@bingoo.ai/ui-web'
import type { LocalizedText, MediaVisibility } from '@bingoo.ai/core'
import { ApiError } from '@/lib/api-client'
import { pickText } from '@/lib/i18n-text'
import {
  useAsset,
  useAttachTags,
  useDeleteAsset,
  usePatchAsset,
  useRemoveTag,
  useTags,
} from '@/lib/media-queries'
import type { MediaAssetDto } from '@/lib/api-types'
import { KindIcon } from './kind-icon'
import { ModerationBadge, StatusBadge } from './media-badges'
import { ModerationActions } from './moderation-actions'

const VISIBILITIES: MediaVisibility[] = ['PRIVATE', 'SCOPE', 'PUBLIC']

interface FormState {
  titleVi: string
  titleEn: string
  descVi: string
  descEn: string
  altVi: string
  altEn: string
  visibility: MediaVisibility
  locale: string
  license: string
  ageRating: string
}

function toForm(a: MediaAssetDto): FormState {
  const g = (v: LocalizedText | null | undefined, k: string) => v?.[k] ?? ''
  return {
    titleVi: g(a.title, 'vi'),
    titleEn: g(a.title, 'en'),
    descVi: g(a.description, 'vi'),
    descEn: g(a.description, 'en'),
    altVi: g(a.altText, 'vi'),
    altEn: g(a.altText, 'en'),
    visibility: a.visibility,
    locale: a.locale ?? '',
    license: a.license ?? '',
    ageRating: a.ageRating ?? '',
  }
}

function localized(vi: string, en: string): LocalizedText | null {
  const out: LocalizedText = {}
  if (vi.trim()) out.vi = vi.trim()
  if (en.trim()) out.en = en.trim()
  return Object.keys(out).length ? out : null
}

/** Full asset detail + inline editing. Rendered inside the controlled Drawer. */
export function AssetDetailPanel({
  assetId,
  canEdit,
  canModerate,
  onDeleted,
}: {
  assetId: string
  canEdit: boolean
  /** MODERATOR|ADMIN — shows the approve/reject/flag actions (server re-enforces). */
  canModerate: boolean
  onDeleted: () => void
}) {
  const t = useTranslations('admin.detail')
  const tv = useTranslations('admin.visibility')
  const locale = useLocale()
  const { toast } = useToast()

  const asset = useAsset(assetId)
  const allTags = useTags()
  const patch = usePatchAsset()
  const del = useDeleteAsset()
  const attach = useAttachTags()
  const removeTag = useRemoveTag()

  const [form, setForm] = useState<FormState | null>(null)
  useEffect(() => {
    if (asset.data) setForm(toForm(asset.data))
  }, [asset.data])

  const slugToId = useMemo(() => {
    const m = new Map<string, string>()
    for (const tg of allTags.data ?? []) m.set(tg.slug, tg.id)
    return m
  }, [allTags.data])

  if (asset.isLoading || !form) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-foreground-subtle" />
      </div>
    )
  }
  if (asset.isError || !asset.data) {
    return <p className="py-8 text-center text-sm text-danger">{t('loadError')}</p>
  }

  const a = asset.data
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))

  const title = localized(form.titleVi, form.titleEn)
  const dirty = form && asset.data && JSON.stringify(form) !== JSON.stringify(toForm(asset.data))

  async function save() {
    if (!title) {
      toast({ variant: 'danger', title: t('titleRequired') })
      return
    }
    try {
      await patch.mutateAsync({
        id: a.id,
        input: {
          title,
          description: localized(form!.descVi, form!.descEn),
          altText: localized(form!.altVi, form!.altEn),
          visibility: form!.visibility,
          locale: form!.locale.trim() || null,
          license: form!.license.trim() || null,
          ageRating: form!.ageRating.trim() || null,
        },
      })
      toast({ variant: 'success', title: t('saved') })
    } catch (err) {
      toast({
        variant: 'danger',
        title: t('saveError'),
        description: err instanceof ApiError ? err.message : undefined,
      })
    }
  }

  async function onDelete() {
    try {
      await del.mutateAsync(a.id)
      toast({ variant: 'success', title: t('deleted') })
      onDeleted()
    } catch (err) {
      toast({
        variant: 'danger',
        title: t('deleteError'),
        description: err instanceof ApiError ? err.message : undefined,
      })
    }
  }

  const currentTags = a.tags ?? []
  const tagOptions: ComboboxOption[] = (allTags.data ?? [])
    .filter((tg) => !currentTags.some((ct) => ct.slug === tg.slug))
    .map((tg) => ({ id: tg.slug, label: pickText(tg.label, locale, tg.slug) }))

  return (
    <div className="space-y-6">
      <Preview asset={a} />

      <div className="flex flex-wrap items-center gap-2">
        <ModerationBadge status={a.moderation} size="sm" />
        <StatusBadge status={a.status} size="sm" />
        <span className="inline-flex items-center gap-1 text-xs text-foreground-subtle">
          <KindIcon kind={a.kind} className="size-3.5" /> {a.kind}
        </span>
      </div>

      {canModerate && (
        <ModerationActions assetId={a.id} moderation={a.moderation} moderationReason={a.moderationReason} />
      )}

      {/* Metadata form */}
      <section className="space-y-3">
        <h3 className="font-display text-sm font-bold text-foreground">{t('metadata')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('titleVi')}>
            <Input
              value={form.titleVi}
              onChange={(e) => set('titleVi', e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label={t('titleEn')}>
            <Input
              value={form.titleEn}
              onChange={(e) => set('titleEn', e.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('descVi')}>
            <Textarea
              rows={2}
              value={form.descVi}
              onChange={(e) => set('descVi', e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label={t('descEn')}>
            <Textarea
              rows={2}
              value={form.descEn}
              onChange={(e) => set('descEn', e.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('altVi')} hint={t('altHint')}>
            <Input value={form.altVi} onChange={(e) => set('altVi', e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label={t('altEn')}>
            <Input value={form.altEn} onChange={(e) => set('altEn', e.target.value)} disabled={!canEdit} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('visibility')}>
            <Select
              value={form.visibility}
              onChange={(e) => set('visibility', e.target.value as MediaVisibility)}
              disabled={!canEdit}
            >
              {VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {tv(v)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('locale')}>
            <Input
              value={form.locale}
              onChange={(e) => set('locale', e.target.value)}
              placeholder="vi"
              disabled={!canEdit}
            />
          </Field>
          <Field label={t('ageRating')}>
            <Input
              value={form.ageRating}
              onChange={(e) => set('ageRating', e.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </div>
        <Field label={t('license')}>
          <Input value={form.license} onChange={(e) => set('license', e.target.value)} disabled={!canEdit} />
        </Field>
        {canEdit && (
          <Button onClick={save} loading={patch.isPending} disabled={!dirty} className="w-full">
            {t('save')}
          </Button>
        )}
      </section>

      {/* Tags */}
      <section className="space-y-2">
        <h3 className="font-display text-sm font-bold text-foreground">{t('tags')}</h3>
        {currentTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {currentTags.map((tg) => (
              <Tag
                key={tg.slug}
                onRemove={
                  canEdit && slugToId.has(tg.slug)
                    ? () => void removeTag.mutate({ id: a.id, tagId: slugToId.get(tg.slug)! })
                    : undefined
                }
              >
                {pickText(tg.label, locale, tg.slug)}
              </Tag>
            ))}
          </div>
        ) : (
          <p className="text-xs text-foreground-subtle">{t('noTags')}</p>
        )}
        {canEdit && tagOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Combobox
                aria-label={t('addTag')}
                placeholder={t('addTag')}
                options={tagOptions}
                onSelectionChange={(slug) => {
                  if (slug) void attach.mutate({ id: a.id, slugs: [slug] })
                }}
              />
            </div>
            <Plus className="size-4 text-foreground-subtle" />
          </div>
        )}
      </section>

      {/* Renditions / downloads */}
      {a.renditions.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-display text-sm font-bold text-foreground">{t('files')}</h3>
          <ul className="space-y-1">
            {a.renditions.map((r) => (
              <li key={r.kind}>
                <a
                  href={r.url ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted"
                >
                  <span className="truncate">
                    {r.kind}
                    {r.mimeType ? <span className="text-foreground-subtle"> · {r.mimeType}</span> : null}
                  </span>
                  <Download className="size-4 shrink-0 text-foreground-subtle" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Danger zone */}
      {canEdit && (
        <section className="border-t border-border pt-4">
          <Dialog
            role="alertdialog"
            trigger={
              <span className="inline-flex items-center gap-1.5">
                <Trash2 className="size-4" /> {t('delete')}
              </span>
            }
            triggerVariant="danger"
            title={t('deleteConfirmTitle')}
            description={t('deleteConfirmBody', { title: pickText(a.title, locale, a.publicId) })}
            closeAriaLabel={t('cancel')}
            footer={(close) => (
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={close}>
                  {t('cancel')}
                </Button>
                <Button
                  variant="danger"
                  loading={del.isPending}
                  onClick={async () => {
                    await onDelete()
                    close()
                  }}
                >
                  {t('delete')}
                </Button>
              </div>
            )}
          />
        </section>
      )}
    </div>
  )
}

function Preview({ asset }: { asset: MediaAssetDto }) {
  const locale = useLocale()
  const alt = pickText(asset.altText, locale, pickText(asset.title, locale, asset.publicId))
  const url =
    asset.renditions.find((r) => r.kind === 'PREVIEW')?.url ??
    asset.renditions.find((r) => r.kind === 'ORIGINAL')?.url ??
    asset.renditions.find((r) => r.kind === 'THUMBNAIL')?.url ??
    asset.renditions.find((r) => r.url)?.url ??
    null

  const box = 'w-full overflow-hidden rounded-2xl border border-border bg-surface-muted'

  if (asset.kind === 'IMAGE' && url) {
    return (
      <div className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className="max-h-72 w-full object-contain" />
      </div>
    )
  }
  if (asset.kind === 'AUDIO' && url) {
    return (
      <div className={`${box} p-4`}>
        <audio controls src={url} className="w-full">
          <track kind="captions" />
        </audio>
      </div>
    )
  }
  if (asset.kind === 'VIDEO' && url) {
    return (
      <div className={box}>
        <video controls src={url} className="max-h-72 w-full">
          <track kind="captions" />
        </video>
      </div>
    )
  }
  return (
    <div className={`${box} grid aspect-video place-items-center text-foreground-subtle`}>
      <KindIcon kind={asset.kind} className="size-12" />
    </div>
  )
}

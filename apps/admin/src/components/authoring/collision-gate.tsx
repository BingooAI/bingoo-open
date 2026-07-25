// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

/**
 * CHỖ THẦY CÔ CHỐT khi máy không phân biệt được hai kiến thức.
 *
 * Quy tắc định danh chặn việc ghi đồ thị khi hai kiến thức giống nhau ở mọi dấu hiệu, và chặn đúng:
 * hai thứ thật sự khác nhau vẫn có thể giống nhau ở mọi dấu hiệu, nên máy tự gộp là làm hỏng căn cứ
 * mà không báo lỗi. Nhưng trước component này, người duyệt chỉ ĐỌC được lời cảnh báo rồi bế tắc —
 * nút Ghi tắt, không lối nào đi tiếp. Trên một chương trình thật thì trùng dấu hiệu xảy ra thường
 * xuyên, nên đó là đường cụt, không phải lan can.
 *
 * Chỗ này hiện đủ để chốt: hai kiến thức là gì, DẤU HIỆU NÀO trùng (một con số phần trăm không nói
 * được điều đó), và đúng hai lối mà quy tắc nêu ra. Quyết định gửi lên server để KIỂM LẠI — kiểm ở
 * trình duyệt là kiểm thiếu, vì nó không có hồ sơ môn lẫn đồ thị đang có.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Callout } from '@bingoo.ai/ui-web'
import { cn } from '@/lib/cn'
import {
  useResolveCollisions,
  type CollisionDecisionDto,
  type CollisionDto,
  type IngestResultDto,
  type ResolveCollisionsResultDto,
} from '@/lib/authoring-queries'

/** Dấu hiệu người duyệt được phép bổ sung. Phạm vi KHÔNG có ở đây — nó là dữ liệu có cấu trúc. */
const DISTINGUISH_AXES = ['object', 'channel', 'representation', 'bloom', 'transfer', 'fluency'] as const

const AXIS_KEY: Record<string, string> = {
  object: 'axObject',
  channel: 'axChannel',
  bloom: 'axBloom',
  scope: 'axScope',
  representation: 'axRepresentation',
  transfer: 'axTransfer',
  fluency: 'axFluency',
}

const label = (t: ReturnType<typeof useTranslations>, m: Record<string, string>, fallback: string): string =>
  m.vi ?? m.en ?? Object.values(m)[0] ?? fallback

export function CollisionGate({
  compiled,
  collisions,
  onResolved,
}: {
  compiled: IngestResultDto['compiled']
  collisions: readonly CollisionDto[]
  onResolved: (r: ResolveCollisionsResultDto) => void
}) {
  const t = useTranslations('admin.authoring')
  const resolve = useResolveCollisions()
  const [decisions, setDecisions] = useState<CollisionDecisionDto[]>([])
  const [drafts, setDrafts] = useState<Record<string, { axis: string; value: string }>>({})
  const [note, setNote] = useState<{ applied: number; left: number; rejected: number } | null>(null)

  if (collisions.length === 0 && !note) return null

  const key = (c: CollisionDto): string => `${c.slugs[0]}|${c.slugs[1]}`
  const decidedFor = (c: CollisionDto): CollisionDecisionDto | undefined =>
    decisions.find((d) =>
      d.kind === 'merge'
        ? (d.keep === c.slugs[0] && d.drop === c.slugs[1]) || (d.keep === c.slugs[1] && d.drop === c.slugs[0])
        : d.slug === c.slugs[0] || d.slug === c.slugs[1],
    )

  const put = (c: CollisionDto, d: CollisionDecisionDto) =>
    setDecisions((prev) => [...prev.filter((p) => p !== decidedFor(c)), d])

  const submit = () => {
    if (decisions.length === 0) return
    resolve.mutate(
      { compiled, decisions },
      {
        onSuccess: (r) => {
          setNote({ applied: r.applied, left: r.collisions.length, rejected: r.rejected.length })
          setDecisions([])
          setDrafts({})
          onResolved(r)
        },
      },
    )
  }

  return (
    <div className="space-y-3">
      {note ? (
        <Callout variant={note.left === 0 ? 'success' : 'warning'} title={t('colDone', note)}>
          <p className="text-sm">{note.left === 0 ? t('colClear') : null}</p>
          {note.rejected > 0 ? <p className="text-sm">{t('colRejected', { n: note.rejected })}</p> : null}
        </Callout>
      ) : null}

      {collisions.length > 0 ? (
        <Callout variant="warning" title={t('colTitle', { n: collisions.length })}>
          <p className="text-sm">{t('colIntro')}</p>
        </Callout>
      ) : null}

      {collisions.map((c) => {
        const f = c.explanation.facets
        const chosen = decidedFor(c)
        const d = drafts[key(c)] ?? { axis: 'object', value: '' }
        return (
          <div key={key(c)} className="space-y-3 rounded-lg border border-warning/50 bg-surface p-3">
            {/* HAI KIẾN THỨC — nhan đề trước, mã sau: thầy cô đọc nhan đề, không đọc mã. */}
            <div className="grid gap-2 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-md bg-surface-muted px-2.5 py-2">
                  <div className="text-sm font-medium text-foreground">
                    {label(t, c.titles[i] ?? {}, c.slugs[i] ?? '')}
                  </div>
                  <div className="font-mono text-[11px] text-foreground-subtle">{c.slugs[i]}</div>
                </div>
              ))}
            </div>

            {/* VÌ SAO MÁY BÍ — từng dấu hiệu, không phải một con số. */}
            {f ? (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
                  {t('colMarks')}
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {f.axes.map((ax) => {
                    const missing = ax.a === undefined || ax.b === undefined
                    return (
                      <li
                        key={ax.axis}
                        className={cn(
                          'rounded border px-1.5 py-0.5 text-[11px]',
                          missing
                            ? 'border-border bg-surface-muted text-foreground-subtle'
                            : ax.same
                              ? 'border-warning/50 bg-warning-soft text-warning'
                              : 'border-success/50 bg-success-soft text-success',
                        )}
                      >
                        {t(AXIS_KEY[ax.axis] ?? 'axObject')}:{' '}
                        {missing ? t('colMissing') : ax.same ? t('colSame') : t('colDiff')}
                        {ax.a !== undefined && !ax.same ? (
                          <span className="ml-1 font-mono opacity-80">
                            {ax.a} / {ax.b}
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
                {f.indistinguishable ? (
                  <p className="mt-1.5 text-xs text-warning">{t('colAllSame', { n: f.comparedCount })}</p>
                ) : null}
              </div>
            ) : null}

            {/* LỐI 1 — gộp. Nói rõ cái bị gộp chuyển quan hệ đi đâu, để không ai bấm mà không biết mất gì. */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-foreground">{t('colMerge')}</div>
              <p className="text-xs text-foreground-muted">{t('colMergeHint')}</p>
              <div className="flex flex-wrap gap-2">
                {[0, 1].map((i) => {
                  const keep = c.slugs[i] ?? ''
                  const drop = c.slugs[1 - i] ?? ''
                  const active = chosen?.kind === 'merge' && chosen.keep === keep
                  return (
                    <Button
                      key={keep}
                      size="sm"
                      variant={active ? 'primary' : 'secondary'}
                      onClick={() => put(c, { kind: 'merge', keep, drop })}
                    >
                      {t('colKeep')}: {label(t, c.titles[i] ?? {}, keep)}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* LỐI 2 — phân biệt. Thầy cô phải NÓI RA điều gì khác, không chỉ bấm "khác nhau". */}
            <div className="space-y-1.5 border-t border-border/60 pt-2.5">
              <div className="text-xs font-semibold text-foreground">{t('colDistinguish')}</div>
              <p className="text-xs text-foreground-muted">{t('colDistinguishHint')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={t('colMarks')}
                  value={d.axis}
                  onChange={(e) => setDrafts((p) => ({ ...p, [key(c)]: { ...d, axis: e.target.value } }))}
                  className="focus-ring rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground"
                >
                  {DISTINGUISH_AXES.map((ax) => (
                    <option key={ax} value={ax}>
                      {t(AXIS_KEY[ax] ?? 'axObject')}
                    </option>
                  ))}
                </select>
                <input
                  value={d.value}
                  placeholder={t('colValuePh')}
                  aria-label={t('colValuePh')}
                  onChange={(e) => setDrafts((p) => ({ ...p, [key(c)]: { ...d, value: e.target.value } }))}
                  className="focus-ring rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground"
                />
                <Button
                  size="sm"
                  variant={chosen?.kind === 'distinguish' ? 'primary' : 'secondary'}
                  disabled={d.value.trim().length === 0}
                  onClick={() =>
                    put(c, {
                      kind: 'distinguish',
                      slug: c.slugs[1] ?? '',
                      axis: d.axis,
                      value: d.value.trim(),
                    })
                  }
                >
                  {label(t, c.titles[1] ?? {}, c.slugs[1] ?? '')}
                </Button>
              </div>
            </div>
          </div>
        )
      })}

      {decisions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-foreground-muted">{t('colPending', { n: decisions.length })}</span>
          <Button size="sm" onClick={submit} loading={resolve.isPending} disabled={resolve.isPending}>
            {t('colDecide')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDecisions([])} disabled={resolve.isPending}>
            {t('colUndo')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

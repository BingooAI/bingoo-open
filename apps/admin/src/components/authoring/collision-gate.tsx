// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

/**
 * CHỖ THẦY CÔ CHỐT khi máy bí.
 *
 * Quy tắc định danh chặn việc ghi đồ thị khi hai kiến thức giống nhau ở mọi dấu hiệu, và chặn đúng:
 * hai thứ thật sự khác nhau vẫn có thể giống nhau ở mọi dấu hiệu, nên máy tự gộp là làm hỏng căn cứ
 * mà không báo lỗi. Nhưng trước component này, người duyệt chỉ ĐỌC được lời cảnh báo rồi bế tắc —
 * nút Ghi tắt, không lối nào đi tiếp. Trên một chương trình thật thì trùng dấu hiệu xảy ra thường
 * xuyên, nên đó là đường cụt, không phải lan can.
 *
 * Cùng một đường cụt xảy ra với hai thứ nữa, và chỗ này mở lối cho cả ba:
 *
 *   TRÙNG DẤU HIỆU — gộp, phân biệt, hoặc nói rằng nó vốn không phải kiến thức dạy được.
 *   QUAY VÒNG      — đường học vòng lại chính nó. Máy thấy vòng, không thấy mắt nào sai; nó chỉ
 *                    nói được mắt nào tự chứng được và mắt nào là phán đoán, nên từng mắt hiện
 *                    kèm bậc đó để người duyệt gỡ đúng cái yếu nhất.
 *
 * Hiện đủ để chốt: cái gì đang vướng, VÌ SAO máy bí (một con số phần trăm không nói được điều đó),
 * và các lối đi. Quyết định gửi lên server để KIỂM LẠI — kiểm ở trình duyệt là kiểm thiếu, vì nó
 * không có hồ sơ môn lẫn đồ thị đang có.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Callout } from '@bingoo.ai/ui-web'
import { cn } from '@/lib/cn'
import { AXIS_KEY, DISTINGUISH_AXES } from '@/lib/facet-labels'
import {
  useResolveCollisions,
  type CollisionDecisionDto,
  type CollisionDto,
  type CycleDto,
  type IngestResultDto,
  type ResolveCollisionsResultDto,
} from '@/lib/authoring-queries'

const label = (t: ReturnType<typeof useTranslations>, m: Record<string, string>, fallback: string): string =>
  m.vi ?? m.en ?? Object.values(m)[0] ?? fallback

export function CollisionGate({
  compiled,
  collisions,
  cycles = [],
  onResolved,
}: {
  compiled: IngestResultDto['compiled']
  collisions: readonly CollisionDto[]
  cycles?: readonly CycleDto[]
  onResolved: (r: ResolveCollisionsResultDto) => void
}) {
  const t = useTranslations('admin.authoring')
  const resolve = useResolveCollisions()
  const [decisions, setDecisions] = useState<CollisionDecisionDto[]>([])
  const [drafts, setDrafts] = useState<Record<string, { axis: string; value: string }>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [note, setNote] = useState<{ applied: number; left: number; rejected: number } | null>(null)

  if (collisions.length === 0 && cycles.length === 0 && !note) return null

  const key = (c: CollisionDto): string => `${c.slugs[0]}|${c.slugs[1]}`
  const touches = (d: CollisionDecisionDto, c: CollisionDto): boolean => {
    if (d.kind === 'merge') {
      return (
        (d.keep === c.slugs[0] && d.drop === c.slugs[1]) || (d.keep === c.slugs[1] && d.drop === c.slugs[0])
      )
    }
    if (d.kind === 'drop-edge') return false // vòng, không phải trùng dấu hiệu
    return d.slug === c.slugs[0] || d.slug === c.slugs[1]
  }
  const decidedFor = (c: CollisionDto): CollisionDecisionDto | undefined =>
    decisions.find((d) => touches(d, c))

  const put = (c: CollisionDto, d: CollisionDecisionDto) =>
    setDecisions((prev) => [...prev.filter((p) => p !== decidedFor(c)), d])

  /** Một mắt của vòng chỉ có một quyết định: gỡ hoặc không. Bấm lại là bỏ chọn. */
  const toggleLink = (from: string, to: string) =>
    setDecisions((prev) => {
      const hit = prev.find((d) => d.kind === 'drop-edge' && d.from === from && d.to === to)
      return hit ? prev.filter((d) => d !== hit) : [...prev, { kind: 'drop-edge', from, to }]
    })

  const submit = () => {
    if (decisions.length === 0) return
    resolve.mutate(
      { compiled, decisions },
      {
        onSuccess: (r) => {
          setNote({
            applied: r.applied,
            left: r.collisions.length + r.cycles.length,
            rejected: r.rejected.length,
          })
          setDecisions([])
          setDrafts({})
          setReasons({})
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

            {/* LỐI 3 — vốn không phải kiến thức. Lý do BẮT BUỘC: bỏ lặng lẽ là mất câu trả lời
                cho "vì sao khung không có cái này". */}
            <div className="space-y-1.5 border-t border-border/60 pt-2.5">
              <div className="text-xs font-semibold text-foreground">{t('colNotKnowledge')}</div>
              <p className="text-xs text-foreground-muted">{t('colNotKnowledgeHint')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={reasons[key(c)] ?? ''}
                  placeholder={t('colReasonPh')}
                  aria-label={t('colReasonPh')}
                  onChange={(e) => setReasons((p) => ({ ...p, [key(c)]: e.target.value }))}
                  className="focus-ring min-w-[16rem] flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground"
                />
                {[0, 1].map((i) => {
                  const slug = c.slugs[i] ?? ''
                  const reason = (reasons[key(c)] ?? '').trim()
                  const active = chosen?.kind === 'drop-concept' && chosen.slug === slug
                  return (
                    <Button
                      key={slug}
                      size="sm"
                      variant={active ? 'primary' : 'secondary'}
                      disabled={reason.length === 0}
                      onClick={() => put(c, { kind: 'drop-concept', slug, reason })}
                    >
                      {t('colDrop')}: {label(t, c.titles[i] ?? {}, slug)}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}

      {/* ── CHUỖI HỌC QUAY VÒNG ────────────────────────────────────────────────────────────────── */}
      {cycles.length > 0 ? (
        <Callout variant="warning" title={t('cycTitle', { n: cycles.length })}>
          <p className="text-sm">{t('cycIntro')}</p>
        </Callout>
      ) : null}

      {cycles.map((cy) => (
        <div key={cy.path.join('>')} className="space-y-3 rounded-lg border border-warning/50 bg-surface p-3">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
              {t('cycPath')}
            </div>
            <ol className="flex flex-wrap items-center gap-1 text-sm text-foreground">
              {cy.links.map((l, i) => (
                <li key={`${l.from}>${l.to}`} className="flex items-center gap-1">
                  <span className="rounded bg-surface-muted px-1.5 py-0.5">
                    {label(t, l.titles[0], l.from)}
                  </span>
                  <span aria-hidden className="text-foreground-subtle">
                    →
                  </span>
                  {i === cy.links.length - 1 ? (
                    <span className="rounded bg-surface-muted px-1.5 py-0.5">
                      {label(t, l.titles[1], l.to)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>

          {/* TỪNG MẮT kèm bậc trung thực — gỡ mắt phán đoán, đừng gỡ mắt máy tự chứng được. */}
          <ul className="space-y-1.5">
            {cy.links.map((l) => {
              const proven = l.explanation.machineProven === true
              const picked = decisions.some(
                (d) => d.kind === 'drop-edge' && d.from === l.from && d.to === l.to,
              )
              return (
                <li
                  key={`${l.from}|${l.to}`}
                  className={cn(
                    'flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-2',
                    picked ? 'border-danger/50 bg-danger-soft' : 'border-border bg-surface-muted',
                  )}
                >
                  <span className="text-sm text-foreground">
                    {label(t, l.titles[0], l.from)}{' '}
                    <span className="text-foreground-subtle">{t('cycBefore')}</span>{' '}
                    {label(t, l.titles[1], l.to)}
                  </span>
                  <span
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-[11px]',
                      proven
                        ? 'border-success/50 bg-success-soft text-success'
                        : 'border-warning/50 bg-warning-soft text-warning',
                    )}
                  >
                    {proven ? t('cycProven') : t('cycJudged')}
                  </span>
                  <Button
                    size="sm"
                    variant={picked ? 'primary' : 'secondary'}
                    className="ml-auto"
                    onClick={() => toggleLink(l.from, l.to)}
                  >
                    {t('cycDrop')}
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

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

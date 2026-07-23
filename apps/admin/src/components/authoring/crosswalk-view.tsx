// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, ArrowLeftRight, CheckCircle2, CircleDashed, CircleAlert } from 'lucide-react'
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Spinner } from '@bingoo.ai/ui-web'
import {
  useCrosswalk,
  useFrameworks,
  type CrosswalkKcDto,
  type GapStatus,
  type ObjectiveGapDto,
} from '@/lib/authoring-queries'
import { cn } from '@/lib/cn'

/**
 * ĐỐI CHIẾU HAI KHUNG cho NGƯỜI DẠY — "học theo khung này, chuyển sang khung kia còn thiếu gì".
 *
 * Không nối objective↔objective (mô hình cấm): TRÙNG là các KC nền cả hai khung cùng dạy; THIẾU là
 * mục tiêu của khung ĐÍCH mà KC nó đòi chưa có trong vốn khung NGUỒN. Đúng câu hỏi crosswalk +
 * chuyển khung mà không cần dịch hồ sơ — báo cáo tính thẳng trên KC nền.
 */

const STATUS_STYLE: Record<GapStatus, { dot: string; badge: 'success' | 'warning' | 'danger' }> = {
  achieved: { dot: 'text-success', badge: 'success' },
  partial: { dot: 'text-warning', badge: 'warning' },
  none: { dot: 'text-danger', badge: 'danger' },
}

function StatusIcon({ status }: { status: GapStatus }) {
  const cls = cn('size-4 shrink-0', STATUS_STYLE[status].dot)
  if (status === 'achieved') return <CheckCircle2 className={cls} />
  if (status === 'partial') return <CircleAlert className={cls} />
  return <CircleDashed className={cls} />
}

function frameworkLabel(name: Record<string, string>, slug: string): string {
  return name.vi ?? name.en ?? slug
}

export function CrosswalkView() {
  const t = useTranslations('admin.authoring')
  const frameworks = useFrameworks()
  const opts = frameworks.data ?? []

  // Mặc định chiều MOET Lớp 1 → Cambridge Stage 2 (câu chuyện rõ nhất: học VN sang Cambridge thiếu gì).
  const [from, setFrom] = useState('moet-primary-math-g1')
  const [to, setTo] = useState('cambridge-primary-math-s2')
  const cw = useCrosswalk(from, to)

  const kcTitle = useMemo(() => {
    const m = new Map<string, string>()
    for (const k of cw.data?.kcs ?? []) m.set(k.slug, k.title)
    return m
  }, [cw.data])

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const report = cw.data?.aToB // aToB = from → to (khung đích đọc qua vốn KC khung nguồn)
  const shared = cw.data?.sharedKcs ?? []
  const missingObjs = (report?.objectives ?? []).filter((o) => o.status !== 'achieved')
  const achievedObjs = (report?.objectives ?? []).filter((o) => o.status === 'achieved')

  const Select = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-[16rem] rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
    >
      {opts.map((o) => (
        <option key={o.slug} value={o.slug}>
          {frameworkLabel(o.name, o.slug)}
        </option>
      ))}
    </select>
  )

  return (
    <div className="space-y-4">
      {/* Chọn chiều: học theo → chuyển sang */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-x-3 gap-y-2 pt-6">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
              {t('crosswalkFrom')}
            </span>
            <Select value={from} onChange={setFrom} />
          </label>
          <button
            type="button"
            onClick={swap}
            aria-label={t('crosswalkSwap')}
            title={t('crosswalkSwap')}
            className="mb-1.5 grid size-9 place-items-center rounded-full border border-border text-foreground-muted transition-colors hover:bg-surface-muted"
          >
            <ArrowLeftRight className="size-4" />
          </button>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
              {t('crosswalkTo')}
            </span>
            <Select value={to} onChange={setTo} />
          </label>
        </CardContent>
      </Card>

      {from === to ? (
        <EmptyState title={t('crosswalkPickTwo')} />
      ) : cw.isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : cw.isError || !cw.data || !report ? (
        <EmptyState title={t('failed')} />
      ) : (
        <>
          {/* Thước đo nhanh: chuyển khung đạt bao nhiêu % */}
          <Card className={cn(report.summary.percent >= 80 ? 'border-success/40' : 'border-warning/40')}>
            <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-6">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{report.summary.percent}%</span>
                <span className="text-sm text-foreground-muted">
                  {t('crosswalkPercentTail', { name: cw.data.b.name })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-[13px]">
                <Badge color="success" tone="soft">
                  {t('crosswalkAchievedN', { n: report.summary.achieved })}
                </Badge>
                {/* "Một phần" chỉ xuất hiện khi mục tiêu neo NHIỀU KC mà chỉ nắm được vài cái — ca nguy
                    hiểm nhất (đạt tính theo AND). Ẩn khi = 0 để khỏi gây rối; tooltip giải thích khi có. */}
                {report.summary.partial > 0 ? (
                  <Badge color="warning" tone="soft" title={t('crosswalkPartialHint')}>
                    {t('crosswalkPartialN', { n: report.summary.partial })}
                  </Badge>
                ) : null}
                <Badge color="danger" tone="soft">
                  {t('crosswalkMissingN', { n: report.summary.none })}
                </Badge>
                <Badge color="teal" tone="soft">
                  {t('crosswalkSharedN', { n: shared.length })}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* BẢN ĐỒ ĐỐI CHIẾU — kiểu Venn phẳng: 3 vùng, đọc bằng VỊ TRÍ + màu, không cạnh chỉ rối */}
          <OverlapPartition kcs={cw.data.kcs} sourceName={cw.data.a.name} targetName={cw.data.b.name} />

          {/* CHI TIẾT: mục tiêu khung ĐÍCH chưa đạt + khái niệm còn thiếu — việc phải dạy khi chuyển */}
          <Card className="border-danger/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRight className="size-4 text-danger" />
                {t('crosswalkGapTitle', { name: cw.data.b.name })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {missingObjs.length === 0 ? (
                <p className="text-sm text-foreground-muted">{t('crosswalkNoGap')}</p>
              ) : (
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {missingObjs.map((o) => (
                    <GapRow key={o.slug} o={o} kcTitle={kcTitle} missingLabel={t('crosswalkMissing')} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {achievedObjs.length > 0 ? (
            <Card className="border-success/25">
              <CardHeader>
                <CardTitle className="text-base">
                  {t('crosswalkAchievedTitle', { name: cw.data.a.name })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {achievedObjs.map((o) => (
                    <li key={o.slug} className="flex items-baseline gap-2 text-[13px]">
                      <StatusIcon status="achieved" />
                      <span>
                        {o.code ? <span className="font-mono text-foreground-subtle">{o.code} </span> : null}
                        <span className="text-foreground">{o.title}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}

function GapRow({
  o,
  kcTitle,
  missingLabel,
}: {
  o: ObjectiveGapDto
  kcTitle: Map<string, string>
  missingLabel: string
}) {
  return (
    <li className="flex gap-2">
      <StatusIcon status={o.status} />
      <div className="min-w-0">
        <div className="text-[13px]">
          {o.code ? <span className="font-mono text-foreground-subtle">{o.code} </span> : null}
          <span className="font-medium text-foreground">{o.title}</span>
        </div>
        {o.missing.length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="text-[11px] uppercase tracking-wide text-foreground-subtle">
              {missingLabel}:
            </span>
            {o.missing.map((k) => (
              <Badge key={k} color="danger" tone="outline" size="sm">
                {kcTitle.get(k) ?? k}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  )
}

// Ba vùng như một VENN phẳng — đọc bằng vị trí + màu: chỉ nguồn · TRÙNG (giữa) · chỉ đích (phải học).
const ZONE = {
  source: {
    border: 'border-primary/25',
    text: 'text-primary',
    badge: 'primary' as const,
    chip: 'border-primary/20 bg-primary-soft/40',
  },
  shared: {
    border: 'border-accent-teal/40',
    text: 'text-accent-teal',
    badge: 'teal' as const,
    chip: 'border-accent-teal/25 bg-accent-teal-soft/50',
  },
  target: {
    border: 'border-accent-coral/30',
    text: 'text-accent-coral',
    badge: 'coral' as const,
    chip: 'border-accent-coral/25 bg-accent-coral-soft/40',
  },
}

function Zone({
  title,
  items,
  z,
  emphasize,
}: {
  title: string
  items: CrosswalkKcDto[]
  z: (typeof ZONE)[keyof typeof ZONE]
  emphasize?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        z.border,
        emphasize && 'bg-accent-teal-soft/10 ring-1 ring-accent-teal/25',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <h4 className={cn('text-[11px] font-semibold uppercase tracking-wide', z.text)}>{title}</h4>
        <Badge color={z.badge} tone="soft" size="sm">
          {items.length}
        </Badge>
      </div>
      {items.length === 0 ? (
        <span className="text-[12px] text-foreground-subtle">—</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((k) => (
            <span
              key={k.slug}
              className={cn('rounded-md border px-2 py-1 text-[12px] leading-tight text-foreground', z.chip)}
            >
              {k.title}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Bản đồ đối chiếu kiểu Venn phẳng — thấy TỔNG ngay: cái nào trùng, cái nào chỉ một khung. */
function OverlapPartition({
  kcs,
  sourceName,
  targetName,
}: {
  kcs: CrosswalkKcDto[]
  sourceName: string
  targetName: string
}) {
  const t = useTranslations('admin.authoring')
  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between gap-2">
        <CardTitle className="text-base">{t('crosswalkGraphTitle')}</CardTitle>
        <span className="truncate text-[12px] text-foreground-subtle">
          {sourceName} · {targetName}
        </span>
      </CardHeader>
      <CardContent className="grid items-start gap-3 md:grid-cols-3">
        <Zone title={t('crosswalkZoneSource')} items={kcs.filter((k) => k.side === 'a')} z={ZONE.source} />
        <Zone
          title={t('crosswalkLegShared')}
          items={kcs.filter((k) => k.side === 'both')}
          z={ZONE.shared}
          emphasize
        />
        <Zone title={t('crosswalkZoneTarget')} items={kcs.filter((k) => k.side === 'b')} z={ZONE.target} />
      </CardContent>
    </Card>
  )
}

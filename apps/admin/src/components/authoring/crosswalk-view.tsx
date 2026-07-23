// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeftRight } from 'lucide-react'
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Spinner } from '@bingoo.ai/ui-web'
import { useCrosswalk, useFrameworks, type CrosswalkKcDto } from '@/lib/authoring-queries'
import { cn } from '@/lib/cn'

/**
 * ĐỐI CHIẾU HAI KHUNG cho NGƯỜI DẠY — "học theo khung này, chuyển sang khung kia còn thiếu gì".
 *
 * Không nối objective↔objective (mô hình cấm): TRÙNG là các KC nền cả hai khung cùng dạy; THIẾU là
 * mục tiêu của khung ĐÍCH mà KC nó đòi chưa có trong vốn khung NGUỒN. Đúng câu hỏi crosswalk +
 * chuyển khung mà không cần dịch hồ sơ — báo cáo tính thẳng trên KC nền.
 */

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

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const report = cw.data?.aToB // aToB = from → to (khung đích đọc qua vốn KC khung nguồn)
  const shared = cw.data?.sharedKcs ?? []

  const Select = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
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
          <label className="flex min-w-[15rem] flex-1 flex-col gap-1">
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
          <label className="flex min-w-[15rem] flex-1 flex-col gap-1">
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

          {/* BẢN ĐỒ ĐỐI CHIẾU — mind-map: khung ĐÍCH ở giữa, tỏa ra 3 nhánh (đã có · cần học · chỉ
              khung nguồn). Đọc "cái nào trùng, cái nào cần" bằng nhánh + màu, không phải đám chỉ rối. */}
          <CrosswalkVenn
            sourceName={cw.data.a.name}
            targetName={cw.data.b.name}
            leftOnly={cw.data.kcs.filter((k) => k.side === 'a')}
            shared={cw.data.kcs.filter((k) => k.side === 'both')}
            rightOnly={cw.data.kcs.filter((k) => k.side === 'b')}
          />
        </>
      )}
    </div>
  )
}

// Tông màu 3 vùng Venn: RIÊNG chương trình cũ (primary) · TRÙNG ở giữa (teal) · CẦN BỔ SUNG (coral).
const VENN = {
  left: { badge: 'primary' as const, text: 'text-primary', chip: 'border-primary/25 bg-primary-soft/50' },
  mid: {
    badge: 'teal' as const,
    text: 'text-accent-teal',
    chip: 'border-accent-teal/30 bg-accent-teal-soft/60',
  },
  right: {
    badge: 'coral' as const,
    text: 'text-accent-coral',
    chip: 'border-accent-coral/25 bg-accent-coral-soft/50',
  },
}
type VennTone = (typeof VENN)[keyof typeof VENN]

function VennZone({
  header,
  items,
  tone,
  align,
}: {
  header: string
  items: CrosswalkKcDto[]
  tone: VennTone
  align: 'start' | 'center' | 'end'
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5',
        align === 'center'
          ? 'items-center text-center'
          : align === 'end'
            ? 'items-end text-right'
            : 'items-start',
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide',
          tone.text,
        )}
      >
        {header}
        <Badge color={tone.badge} tone="soft" size="sm">
          {items.length}
        </Badge>
      </span>
      {items.length === 0 ? (
        <span className="text-[12px] text-foreground-subtle">—</span>
      ) : (
        items.map((k) => (
          <span
            key={k.slug}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[12px] leading-tight text-foreground',
              tone.chip,
            )}
          >
            {k.title}
          </span>
        ))
      )}
    </div>
  )
}

/** Biểu đồ VENN: chương trình cũ ∩ chương trình mới. Phần TRÙNG ở giữa, riêng mỗi bên ở hai rìa —
 *  hình chuẩn để đọc "cái gì chung, cái gì phải bổ sung". */
function CrosswalkVenn({
  sourceName,
  targetName,
  leftOnly,
  shared,
  rightOnly,
}: {
  sourceName: string
  targetName: string
  leftOnly: CrosswalkKcDto[]
  shared: CrosswalkKcDto[]
  rightOnly: CrosswalkKcDto[]
}) {
  const t = useTranslations('admin.authoring')
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('crosswalkGraphTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Tên hai chương trình gắn với hai vòng */}
        <div className="mb-3 flex items-baseline justify-between gap-3 text-[12px] font-semibold">
          <span className="min-w-0 truncate text-primary">◖ {sourceName}</span>
          <span className="min-w-0 truncate text-right text-accent-coral">{targetName} ◗</span>
        </div>
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border/60 px-4 py-6 sm:px-8">
          {/* HAI VÒNG chồng nhau (preserveAspectRatio=none → luôn phủ đúng khung; overlap ở GIỮA) */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <ellipse
              cx="34"
              cy="50"
              rx="33"
              ry="47"
              fill="var(--color-primary)"
              fillOpacity="0.06"
              stroke="var(--color-primary)"
              strokeOpacity="0.3"
              strokeWidth="0.3"
            />
            <ellipse
              cx="66"
              cy="50"
              rx="33"
              ry="47"
              fill="var(--color-accent-coral)"
              fillOpacity="0.06"
              stroke="var(--color-accent-coral)"
              strokeOpacity="0.3"
              strokeWidth="0.3"
            />
          </svg>
          <div className="relative grid grid-cols-3 items-start gap-2">
            <VennZone header={t('crosswalkVennLeft')} items={leftOnly} tone={VENN.left} align="start" />
            <VennZone header={t('crosswalkVennMid')} items={shared} tone={VENN.mid} align="center" />
            <VennZone header={t('crosswalkVennRight')} items={rightOnly} tone={VENN.right} align="end" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

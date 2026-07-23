// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeftRight } from 'lucide-react'
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Spinner } from '@bingoo.ai/ui-web'
import { useCrosswalk, useFrameworks, type CrosswalkDto } from '@/lib/authoring-queries'
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

          {/* BẢN ĐỒ ĐỐI CHIẾU — biểu đồ VENN: chương trình đang học ∩ chương trình mới; trùng ở giữa,
              cần bổ sung ở rìa phải. Đọc bằng vùng — hình chuẩn cho "so hai tập". */}
          <CrosswalkVenn data={cw.data} />
        </>
      )}
    </div>
  )
}

// Tông màu 3 vùng Venn: CHƯƠNG TRÌNH ĐANG HỌC (primary) · TRÙNG ở giữa (teal) · CẦN BỔ SUNG (coral).
const VENN = {
  left: { badge: 'primary' as const, text: 'text-primary', chip: 'border-primary/30', code: 'text-primary' },
  mid: {
    badge: 'teal' as const,
    text: 'text-accent-teal',
    chip: 'border-accent-teal/35',
    code: 'text-accent-teal',
  },
  right: {
    badge: 'coral' as const,
    text: 'text-accent-coral',
    chip: 'border-accent-coral/30',
    code: 'text-accent-coral',
  },
}
type VennTone = (typeof VENN)[keyof typeof VENN]

interface ZoneItem {
  slug: string
  title: string
  code: string
}

function VennZone({ header, items, tone }: { header: string; items: ZoneItem[]; tone: VennTone }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
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
              'max-w-[12rem] rounded-lg border bg-surface/85 px-2 py-1 text-[11px] leading-tight text-foreground shadow-sm backdrop-blur-sm',
              tone.chip,
            )}
          >
            {k.code ? <span className={cn('mr-1 font-mono font-semibold', tone.code)}>{k.code}</span> : null}
            {k.title}
          </span>
        ))
      )}
    </div>
  )
}

/** Biểu đồ VENN: chương trình đang học ∩ chương trình mới. Vòng tròn THẬT (viewBox 300×200 khớp tỉ lệ
 *  khung 3:2 nên scale đều), chữ nằm TRONG vòng. Phần trùng ở giữa; mã LO in kèm (giữa = cặp nguồn↔đích). */
function CrosswalkVenn({ data }: { data: CrosswalkDto }) {
  const t = useTranslations('admin.authoring')

  const srcCode = new Map<string, string>()
  for (const o of data.a.objectives) for (const k of o.requires) if (o.code) srcCode.set(k, o.code)
  const tgtCode = new Map<string, string>()
  for (const o of data.b.objectives) for (const k of o.requires) if (o.code) tgtCode.set(k, o.code)

  const zone = (side: 'a' | 'b' | 'both', code: (slug: string) => string): ZoneItem[] =>
    data.kcs.filter((k) => k.side === side).map((k) => ({ slug: k.slug, title: k.title, code: code(k.slug) }))
  const left = zone('a', (s) => srcCode.get(s) ?? '')
  const mid = zone('both', (s) => [srcCode.get(s), tgtCode.get(s)].filter(Boolean).join(' ↔ '))
  const right = zone('b', (s) => tgtCode.get(s) ?? '')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('crosswalkGraphTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Tên hai chương trình gắn hai vòng */}
        <div className="mb-2 flex items-baseline justify-between gap-3 text-[12px] font-semibold">
          <span className="min-w-0 truncate text-primary">◖ {data.a.name}</span>
          <span className="min-w-0 truncate text-right text-accent-coral">{data.b.name} ◗</span>
        </div>
        {/* Khung tỉ lệ 3:2 == viewBox 300×200 → circle TRÒN thật, canh đúng 3 cột. */}
        <div className="relative mx-auto aspect-[3/2] w-full max-w-3xl">
          <svg
            aria-hidden
            viewBox="0 0 300 200"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <circle
              cx="102"
              cy="100"
              r="90"
              fill="var(--color-primary)"
              fillOpacity="0.07"
              stroke="var(--color-primary)"
              strokeOpacity="0.35"
              strokeWidth="1.2"
            />
            <circle
              cx="198"
              cy="100"
              r="90"
              fill="var(--color-accent-coral)"
              fillOpacity="0.07"
              stroke="var(--color-accent-coral)"
              strokeOpacity="0.35"
              strokeWidth="1.2"
            />
          </svg>
          <div className="absolute inset-0 grid grid-cols-3 items-center gap-1 px-3 py-4">
            <VennZone header={t('crosswalkVennLeft')} items={left} tone={VENN.left} />
            <VennZone header={t('crosswalkVennMid')} items={mid} tone={VENN.mid} />
            <VennZone header={t('crosswalkVennRight')} items={right} tone={VENN.right} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

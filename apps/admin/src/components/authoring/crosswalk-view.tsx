// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeftRight, CheckCircle2, CircleDashed, Target, type LucideIcon } from 'lucide-react'
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
          <CrosswalkMindmap
            centerName={cw.data.b.name}
            have={cw.data.kcs.filter((k) => k.side === 'both')}
            need={cw.data.kcs.filter((k) => k.side === 'b')}
            sourceOnly={cw.data.kcs.filter((k) => k.side === 'a')}
          />
        </>
      )}
    </div>
  )
}

// Ba nhánh của mind-map: ĐÃ CÓ (trùng, teal) · CẦN HỌC (coral) · CHỈ KHUNG NGUỒN (primary).
const BRANCH = {
  have: {
    text: 'text-accent-teal',
    border: 'border-accent-teal/40',
    bg: 'bg-accent-teal-soft/25',
    dot: 'bg-accent-teal',
    badge: 'teal' as const,
    stroke: 'var(--color-accent-teal)',
  },
  need: {
    text: 'text-accent-coral',
    border: 'border-accent-coral/40',
    bg: 'bg-accent-coral-soft/25',
    dot: 'bg-accent-coral',
    badge: 'coral' as const,
    stroke: 'var(--color-accent-coral)',
  },
  source: {
    text: 'text-primary',
    border: 'border-primary/35',
    bg: 'bg-primary-soft/30',
    dot: 'bg-primary',
    badge: 'primary' as const,
    stroke: 'var(--color-primary)',
  },
}
type BranchTone = (typeof BRANCH)[keyof typeof BRANCH]

function Branch({
  headerRef,
  tone,
  Icon,
  title,
  items,
  align,
}: {
  headerRef: React.Ref<HTMLDivElement>
  tone: BranchTone
  Icon: LucideIcon
  title: string
  items: CrosswalkKcDto[]
  align: 'left' | 'right'
}) {
  const right = align === 'right'
  return (
    <div className={cn('flex flex-col gap-2', right ? 'lg:items-end' : 'lg:items-start')}>
      <div
        ref={headerRef}
        className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1', tone.border, tone.bg)}
      >
        <Icon className={cn('size-3.5', tone.text)} />
        <span className={cn('text-[12px] font-semibold uppercase tracking-wide', tone.text)}>{title}</span>
        <Badge color={tone.badge} tone="soft" size="sm">
          {items.length}
        </Badge>
      </div>
      {items.length === 0 ? (
        <span className="text-[12px] text-foreground-subtle">—</span>
      ) : (
        <ul className={cn('flex w-full flex-col gap-1.5', right && 'lg:items-end')}>
          {items.map((k) => (
            <li
              key={k.slug}
              className={cn(
                'flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 text-[13px] text-foreground shadow-sm',
                right && 'lg:flex-row-reverse lg:text-right',
              )}
            >
              <span className={cn('size-2 shrink-0 rounded-full', tone.dot)} />
              {k.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Mind-map đối chiếu: khung ĐÍCH ở giữa, tỏa ra ĐÃ CÓ (trùng) · CẦN HỌC · CHỈ KHUNG NGUỒN. Đường
 *  cong nối tâm → từng nhánh được đo từ vị trí thật (ref) nên co giãn theo bề rộng. */
function CrosswalkMindmap({
  centerName,
  have,
  need,
  sourceOnly,
}: {
  centerName: string
  have: CrosswalkKcDto[]
  need: CrosswalkKcDto[]
  sourceOnly: CrosswalkKcDto[]
}) {
  const t = useTranslations('admin.authoring')
  const wrap = useRef<HTMLDivElement>(null)
  const center = useRef<HTMLDivElement>(null)
  const haveH = useRef<HTMLDivElement>(null)
  const needH = useRef<HTMLDivElement>(null)
  const srcH = useRef<HTMLDivElement>(null)
  const [paths, setPaths] = useState<{ d: string; stroke: string }[]>([])

  useEffect(() => {
    const measure = () => {
      const w = wrap.current
      const c = center.current
      if (!w || !c) return
      const wr = w.getBoundingClientRect()
      const cr = c.getBoundingClientRect()
      const cx = cr.left + cr.width / 2 - wr.left
      const cy = cr.top + cr.height / 2 - wr.top
      const curve = (el: HTMLDivElement | null, toLeft: boolean, stroke: string) => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        const hx = (toLeft ? r.right : r.left) - wr.left
        const hy = r.top + r.height / 2 - wr.top
        const k = (hx - cx) * 0.5
        return { d: `M ${cx} ${cy} C ${cx + k} ${cy}, ${hx - k} ${hy}, ${hx} ${hy}`, stroke }
      }
      setPaths(
        [
          curve(srcH.current, true, BRANCH.source.stroke),
          curve(haveH.current, false, BRANCH.have.stroke),
          curve(needH.current, false, BRANCH.need.stroke),
        ].filter((p): p is { d: string; stroke: string } => p !== null),
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrap.current) ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [have, need, sourceOnly, centerName])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('crosswalkGraphTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={wrap} className="relative">
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            {paths.map((p, i) => (
              <path key={i} d={p.d} fill="none" stroke={p.stroke} strokeWidth={2} strokeOpacity={0.5} />
            ))}
          </svg>
          <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.5fr)] lg:items-center">
            {/* TRÁI: chỉ khung nguồn (bạn đã có, khung mới không cần) */}
            <Branch
              headerRef={srcH}
              tone={BRANCH.source}
              Icon={Target}
              title={t('crosswalkZoneSource')}
              items={sourceOnly}
              align="right"
            />
            {/* GIỮA: khung ĐÍCH */}
            <div
              ref={center}
              className="mx-auto grid aspect-square w-40 place-items-center rounded-full border-2 border-border bg-surface p-5 text-center shadow-md"
            >
              <span className="text-[13px] font-semibold leading-snug text-foreground">{centerName}</span>
            </div>
            {/* PHẢI: đã có (trùng) + cần học */}
            <div className="flex flex-col gap-8">
              <Branch
                headerRef={haveH}
                tone={BRANCH.have}
                Icon={CheckCircle2}
                title={t('crosswalkMindHave')}
                items={have}
                align="left"
              />
              <Branch
                headerRef={needH}
                tone={BRANCH.need}
                Icon={CircleDashed}
                title={t('crosswalkMindNeed')}
                items={need}
                align="left"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

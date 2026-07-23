// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  LayoutGrid,
  List,
} from 'lucide-react'
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Spinner } from '@bingoo.ai/ui-web'
import {
  useCrosswalk,
  useFrameworks,
  type CrosswalkDto,
  type FrameworkReportDto,
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
  // Venn = trực quan theo CHỦ ĐỀ; Danh sách = scale được cho CẢ MÔN (Venn nhiều KC là chịu).
  const [view, setView] = useState<'venn' | 'list'>('venn')
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

          {/* Chọn cách xem: Venn (trực quan, hợp theo chủ đề) hay Danh sách (scale cho cả môn). */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 text-[13px] sm:w-fit">
            <button
              type="button"
              onClick={() => setView('venn')}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors sm:flex-none',
                view === 'venn'
                  ? 'bg-primary-soft font-medium text-primary-soft-foreground'
                  : 'text-foreground-muted hover:bg-surface-muted',
              )}
            >
              <LayoutGrid className="size-3.5" />
              {t('crosswalkViewVenn')}
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors sm:flex-none',
                view === 'list'
                  ? 'bg-primary-soft font-medium text-primary-soft-foreground'
                  : 'text-foreground-muted hover:bg-surface-muted',
              )}
            >
              <List className="size-3.5" />
              {t('crosswalkViewList')}
            </button>
          </div>

          {view === 'venn' ? (
            <CrosswalkVenn data={cw.data} />
          ) : (
            <CrosswalkList data={cw.data} report={report} />
          )}
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
    <div className="flex flex-col items-center gap-2.5 text-center">
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
              'max-w-[13rem] rounded-full border bg-surface/90 px-3 py-1.5 text-[11px] leading-tight text-foreground shadow-sm backdrop-blur-sm',
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
        {/* Khung tỉ lệ 7:5 == viewBox 350×250 → circle TRÒN thật, canh đúng 3 cột, đủ cao cho ~6 chip. */}
        <div className="relative mx-auto aspect-[7/5] w-full max-w-4xl">
          <svg
            aria-hidden
            viewBox="0 0 350 250"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <circle
              cx="120"
              cy="125"
              r="115"
              fill="var(--color-primary)"
              fillOpacity="0.06"
              stroke="var(--color-primary)"
              strokeOpacity="0.35"
              strokeWidth="1.2"
            />
            <circle
              cx="230"
              cy="125"
              r="115"
              fill="var(--color-accent-coral)"
              fillOpacity="0.06"
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

// ── Dạng DANH SÁCH — scale được cho CẢ MÔN (Venn chỉ hợp theo chủ đề, nhiều KC là chịu) ─────────
const STATUS_STYLE: Record<GapStatus, string> = {
  achieved: 'text-success',
  partial: 'text-warning',
  none: 'text-danger',
}

function StatusIcon({ status }: { status: GapStatus }) {
  const cls = cn('size-4 shrink-0', STATUS_STYLE[status])
  if (status === 'achieved') return <CheckCircle2 className={cls} />
  if (status === 'partial') return <CircleAlert className={cls} />
  return <CircleDashed className={cls} />
}

function GapObjective({
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

/** Danh sách đối chiếu — chịu tải tốt khi CẢ MÔN có hàng trăm KC: mục tiêu còn thiếu (kèm khái niệm
 *  phải học) · phần trùng · phần đã có. Không hình học, chỉ danh sách cuộn được. */
function CrosswalkList({ data, report }: { data: CrosswalkDto; report: FrameworkReportDto }) {
  const t = useTranslations('admin.authoring')
  const kcTitle = new Map(data.kcs.map((k) => [k.slug, k.title]))
  const missing = report.objectives.filter((o) => o.status !== 'achieved')
  const achieved = report.objectives.filter((o) => o.status === 'achieved')
  const shared = data.kcs.filter((k) => k.side === 'both')

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-danger/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRight className="size-4 text-danger" />
            {t('crosswalkGapTitle', { name: data.b.name })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {missing.length === 0 ? (
            <p className="text-sm text-foreground-muted">{t('crosswalkNoGap')}</p>
          ) : (
            <ul className="space-y-2.5">
              {missing.map((o) => (
                <GapObjective key={o.slug} o={o} kcTitle={kcTitle} missingLabel={t('crosswalkMissing')} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-accent-teal/25">
          <CardHeader>
            <CardTitle className="text-base">{t('crosswalkOverlap')}</CardTitle>
          </CardHeader>
          <CardContent>
            {shared.length === 0 ? (
              <p className="text-sm text-foreground-subtle">{t('crosswalkNoOverlap')}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {shared.map((k) => (
                  <Badge key={k.slug} color="teal" tone="soft">
                    {k.title}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {achieved.length > 0 ? (
          <Card className="border-success/25">
            <CardHeader>
              <CardTitle className="text-base">
                {t('crosswalkAchievedTitle', { name: data.a.name })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1 sm:grid-cols-2">
                {achieved.map((o) => (
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
      </div>
    </div>
  )
}

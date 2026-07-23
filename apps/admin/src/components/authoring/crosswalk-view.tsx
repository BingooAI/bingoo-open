// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, ArrowLeftRight, CheckCircle2, CircleDashed, CircleAlert } from 'lucide-react'
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Spinner } from '@bingoo.ai/ui-web'
import { useCrosswalk, useFrameworks, type GapStatus, type ObjectiveGapDto } from '@/lib/authoring-queries'
import { GraphCanvas, type GEdge, type GNode } from './graph-canvas'
import { cn } from '@/lib/cn'

// Màu tường minh cho đồ thị đối chiếu: KC TRÙNG (teal) · chỉ khung nguồn (primary) · chỉ khung đích (coral).
const TINT = {
  shared: { fill: 'var(--color-accent-teal-soft)', stroke: 'var(--color-accent-teal)' },
  source: { fill: 'var(--color-primary-soft)', stroke: 'var(--color-primary)' },
  target: { fill: 'var(--color-accent-coral-soft)', stroke: 'var(--color-accent-coral)' },
}

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

  // ĐỒ THỊ đối chiếu: 3 băng — objective NGUỒN (trên) · KC nền (giữa, tô theo side) · objective ĐÍCH
  // (dưới). KC TRÙNG (teal) được objective CẢ HAI khung nối tới → bắc cầu, nhìn ra ngay cái nào chung.
  const graph = useMemo((): { nodes: GNode[]; edges: GEdge[] } => {
    const d = cw.data
    if (!d) return { nodes: [], edges: [] }
    const nodes: GNode[] = [
      ...d.a.objectives.map((o): GNode => ({
        id: o.slug,
        label: o.title,
        kind: 'OBJECTIVE',
        band: 0,
        tint: TINT.source,
        ...(o.code ? { meta: o.code } : {}),
      })),
      ...d.kcs.map((k): GNode => ({
        id: k.slug,
        label: k.title,
        kind: 'KC',
        band: 1,
        tint: k.side === 'both' ? TINT.shared : k.side === 'a' ? TINT.source : TINT.target,
        ...(k.strand ? { group: k.strand } : {}),
      })),
      ...d.b.objectives.map((o): GNode => ({
        id: o.slug,
        label: o.title,
        kind: 'OBJECTIVE',
        band: 2,
        tint: TINT.target,
        ...(o.code ? { meta: o.code } : {}),
      })),
    ]
    const edges: GEdge[] = d.edges.map((e) => ({ from: e.from, to: e.to, relType: e.relType }))
    return { nodes, edges }
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
                <Badge color="warning" tone="soft">
                  {t('crosswalkPartialN', { n: report.summary.partial })}
                </Badge>
                <Badge color="danger" tone="soft">
                  {t('crosswalkMissingN', { n: report.summary.none })}
                </Badge>
                <Badge color="teal" tone="soft">
                  {t('crosswalkSharedN', { n: shared.length })}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* ĐỒ THỊ đối chiếu — nhìn ra cái nào TRÙNG (teal, nối cả hai khung) cái nào chỉ một bên */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('crosswalkGraphTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <GraphCanvas
                nodes={graph.nodes}
                edges={graph.edges}
                height={480}
                legend={[
                  { color: 'var(--color-accent-teal)', label: t('crosswalkLegShared') },
                  { color: 'var(--color-primary)', label: cw.data.a.name },
                  { color: 'var(--color-accent-coral)', label: cw.data.b.name },
                ]}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* CÒN THIẾU khi chuyển sang khung đích — điểm nhấn */}
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
                  <ul className="space-y-2.5">
                    {missingObjs.map((o) => (
                      <GapRow key={o.slug} o={o} kcTitle={kcTitle} missingLabel={t('crosswalkMissing')} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Trùng + đã đạt sẵn */}
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
                        <Badge key={k} color="teal" tone="soft">
                          {kcTitle.get(k) ?? k}
                        </Badge>
                      ))}
                    </div>
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
                    <ul className="space-y-1">
                      {achievedObjs.map((o) => (
                        <li key={o.slug} className="flex items-baseline gap-2 text-[13px]">
                          <StatusIcon status="achieved" />
                          <span>
                            {o.code ? (
                              <span className="font-mono text-foreground-subtle">{o.code} </span>
                            ) : null}
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

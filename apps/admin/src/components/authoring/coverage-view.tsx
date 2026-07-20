'use client'

import { useMemo, useState } from 'react'
import { Badge, Callout, Card, CardContent, CardHeader, CardTitle, EmptyState, Spinner } from '@bingoo/ui-web'
import { GraphCanvas, type GEdge, type GNode } from './graph-canvas'
import { useCourses, useCoverage, useFrameworks } from '@/lib/authoring-queries'

/**
 * ĐỘ PHỦ 2 CHIỀU — khung ↕ KC ↕ khoá học.
 *
 * KC là xương sống ở giữa. Trên: objective của khung. Dưới: bài học của khoá. Chỉ khi nhìn đủ hai
 * chiều mới thấy TÍNH CHẶT CHẼ:
 *   • đỏ  = objective KHÔNG bài nào dạy → học xong khoá vẫn KHÔNG đạt chuẩn
 *   • vàng = objective phủ MỘT PHẦN → NGUY HIỂM NHẤT: certify dùng AND nên thiếu một mắt xích là trượt
 *   • xám = KC được dạy mà KHÔNG objective nào chứng nhận → dạy thừa
 */
export function CoverageView() {
  const frameworks = useFrameworks()
  const courses = useCourses()
  const [fw, setFw] = useState('')
  const [course, setCourse] = useState('')

  const fwSlug = fw || frameworks.data?.[0]?.slug || ''
  const courseSlug = course || courses.data?.[0]?.slug || ''
  const cov = useCoverage(fwSlug, courseSlug)

  const { nodes, edges } = useMemo(() => {
    const d = cov.data
    if (!d) return { nodes: [] as GNode[], edges: [] as GEdge[] }

    const covBySlug = new Map(d.objectiveCoverage.map((o) => [o.slug, o]))
    const untethered = new Set(d.untetheredKcs)

    const objNodes: GNode[] = d.objectives.map((o) => {
      const c = covBySlug.get(o.slug)
      return {
        id: o.slug,
        label: o.title,
        kind: 'OBJECTIVE',
        band: 0,
        status: c?.status,
        ...(o.strand ? { group: o.strand } : {}),
        meta: c
          ? `${o.code ?? 'OBJECTIVE'} · dạy ${c.taught.length}/${c.requires.length}`
          : (o.code ?? 'OBJECTIVE'),
      }
    })

    const kcNodes: GNode[] = d.kcs.map((k) => {
      const f = (k.facets ?? {}) as Record<string, unknown>
      const obj = typeof f.object === 'string' ? f.object : null
      const scope = f.scope ? JSON.stringify(f.scope) : null
      return {
        id: k.slug,
        label: k.title,
        kind: k.kind,
        band: 1,
        ...(k.strand ? { group: k.strand } : {}),
        ...(untethered.has(k.slug) ? { status: 'untethered' as const } : {}),
        meta: [obj, scope].filter(Boolean).join(' · ') || k.kind,
      }
    })

    const lessonNodes: GNode[] = d.lessons.map((l) => ({
      id: `lesson:${l.slug}`,
      label: l.title,
      kind: 'LESSON',
      band: 2,
      meta: l.unit,
    }))

    const teaches: GEdge[] = d.lessons.flatMap((l) =>
      l.teaches.map((k) => ({ from: `lesson:${l.slug}`, to: k, relType: 'TEACHES' })),
    )

    return {
      nodes: [...objNodes, ...kcNodes, ...lessonNodes],
      edges: [...d.edges, ...teaches],
    }
  }, [cov.data])

  const sel = (v: string, set: (s: string) => void, opts: { slug: string; label: string }[], cur: string) => (
    <select
      value={cur}
      onChange={(e) => set(e.target.value)}
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
    >
      {opts.map((o) => (
        <option key={o.slug} value={o.slug}>
          {o.label}
        </option>
      ))}
    </select>
  )

  const s = cov.data?.summary

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Khung ↕ Năng lực ↕ Khoá học</CardTitle>
          <div className="flex flex-wrap gap-2">
            {sel(
              fwSlug,
              setFw,
              (frameworks.data ?? []).map((f) => ({
                slug: f.slug,
                label: f.name.vi ?? f.name.en ?? f.slug,
              })),
              fwSlug,
            )}
            {sel(
              courseSlug,
              setCourse,
              (courses.data ?? []).map((c) => {
                const t = (c.title as Record<string, string> | null) ?? {}
                return { slug: c.slug, label: t.vi ?? t.en ?? c.slug }
              }),
              courseSlug,
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {s ? (
            <div className="flex flex-wrap gap-2">
              <Badge color="success">Mục tiêu phủ đủ: {s.objectivesFull}</Badge>
              <Badge color="warning">Phủ một phần: {s.objectivesPartial}</Badge>
              <Badge color="danger">Chưa dạy: {s.objectivesNone}</Badge>
              <Badge tone="soft">
                KC được dạy: {s.kcsTaught}/{s.kcsTotal}
              </Badge>
            </div>
          ) : null}

          {s && s.objectivesPartial > 0 ? (
            <Callout variant="warning" title={`${s.objectivesPartial} mục tiêu chỉ được phủ MỘT PHẦN`}>
              Nguy hiểm nhất. Chứng nhận dùng <b>AND</b> trên mọi KC mà mục tiêu neo vào — thiếu một mắt xích
              là <b>không đạt</b>. Nhìn "gần đủ" nhưng thực chất trượt.
            </Callout>
          ) : null}

          {s && s.objectivesNone > 0 ? (
            <Callout variant="danger" title={`${s.objectivesNone} mục tiêu KHÔNG bài nào dạy`}>
              Học hết khoá vẫn không đạt được những mục tiêu này của khung.
            </Callout>
          ) : null}

          {cov.data && cov.data.untetheredKcs.length > 0 ? (
            <Callout
              variant="warning"
              title={`${cov.data.untetheredKcs.length} năng lực được dạy mà không mục tiêu nào chứng nhận`}
            >
              <span className="font-mono text-xs">{cov.data.untetheredKcs.join(', ')}</span>
            </Callout>
          ) : null}

          {cov.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : cov.data ? (
            <GraphCanvas
              nodes={nodes}
              edges={edges}
              height={620}
              legend={[
                { color: 'var(--color-primary)', label: 'Mục tiêu (khung)' },
                { color: 'var(--color-accent-sunbeam)', label: 'Năng lực' },
                { color: 'var(--color-accent-teal)', label: 'Bài học (khoá)' },
                { color: 'var(--color-success)', label: 'Phủ đủ' },
                { color: 'var(--color-warning)', label: 'Phủ một phần' },
                { color: 'var(--color-danger)', label: 'Chưa dạy' },
              ]}
            />
          ) : (
            <EmptyState title="Chọn một khung và một khoá học" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

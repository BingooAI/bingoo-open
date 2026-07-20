/** Kiểm bản nháp đã compile — tái dùng validator của engine. Lưới an toàn học thuật. */

import { buildGraph, coverageReport, findOrderingCycle, type GraphData } from '@bingoo.ai/knowledge-engine'
import type { CompiledFramework } from './compile'

export type IssueSeverity = 'error' | 'warning'

export interface DraftIssue {
  readonly code:
    | 'EMPTY'
    | 'ORDERING_CYCLE'
    | 'OBJECTIVE_NO_MAPPING'
    | 'MAPPING_TARGET_MISSING'
    | 'ISOLATED_CONCEPT'
    | 'DUPLICATE_SLUG'
  readonly severity: IssueSeverity
  readonly message: string
  readonly refs?: readonly string[]
}

function isLearnable(kind: string): boolean {
  return kind === 'KNOWLEDGE' || kind === 'SKILL' || kind === 'DISPOSITION'
}

/** Trả danh sách vấn đề (error chặn publish; warning để soạn giả xem lại). */
export function validateDraft(compiled: CompiledFramework): DraftIssue[] {
  const issues: DraftIssue[] = []
  const graph: GraphData = compiled.graph

  if (graph.nodes.length === 0) {
    return [{ code: 'EMPTY', severity: 'error', message: 'Không trích được khái niệm nào.' }]
  }

  // trùng slug (không nên xảy ra sau dedup, nhưng chặn cho chắc)
  const seen = new Set<string>()
  for (const n of graph.nodes) {
    if (seen.has(n.slug)) {
      issues.push({
        code: 'DUPLICATE_SLUG',
        severity: 'error',
        message: `Slug trùng: ${n.slug}`,
        refs: [n.slug],
      })
    }
    seen.add(n.slug)
  }

  const sg = buildGraph(graph)

  // chu trình ordering — engine validator
  const cycle = findOrderingCycle(sg)
  if (cycle) {
    issues.push({
      code: 'ORDERING_CYCLE',
      severity: 'error',
      message: `Có chu trình tiên quyết: ${cycle.join(' → ')}`,
      refs: cycle,
    })
  }

  // objective phải có MAPS_TO tới concept có trong graph — dùng coverageReport
  const objectiveSlugs = graph.nodes.filter((n) => n.kind === 'OBJECTIVE').map((n) => n.slug)
  const conceptSlugs = new Set(graph.nodes.filter((n) => n.kind !== 'OBJECTIVE').map((n) => n.slug))
  if (objectiveSlugs.length > 0) {
    const cov = coverageReport(sg, objectiveSlugs, new Set(), conceptSlugs)
    for (const missing of cov.missing) {
      const hasMapping = sg.mapsTo(missing).length > 0
      issues.push(
        hasMapping
          ? {
              code: 'MAPPING_TARGET_MISSING',
              severity: 'error',
              message: `Objective "${missing}" ánh xạ tới khái niệm không có trong graph.`,
              refs: [missing],
            }
          : {
              code: 'OBJECTIVE_NO_MAPPING',
              severity: 'error',
              message: `Objective "${missing}" chưa ánh xạ (MAPS_TO) tới khái niệm nào.`,
              refs: [missing],
            },
      )
    }
  }

  // concept học được nhưng cô lập (không cạnh nào) — cảnh báo
  for (const n of graph.nodes) {
    if (!isLearnable(n.kind)) continue
    const lonely =
      sg.prereqsOf(n.slug).length === 0 &&
      sg.unlockedBy(n.slug).length === 0 &&
      sg.lateralOf(n.slug).length === 0
    if (lonely) {
      issues.push({
        code: 'ISOLATED_CONCEPT',
        severity: 'warning',
        message: `Khái niệm "${n.slug}" chưa nối với cái nào (xem lại tiên quyết).`,
        refs: [n.slug],
      })
    }
  }

  return issues
}

export function hasBlockingIssue(issues: readonly DraftIssue[]): boolean {
  return issues.some((i) => i.severity === 'error')
}

// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Kiểm bản nháp đã compile — tái dùng validator của engine. Lưới an toàn học thuật. */

import { buildGraph, coverageReport, findOrderingCycle, type GraphData } from '@bingoo.ai/knowledge-engine'
import type { CompiledFramework } from './compile'

/**
 * `info` KHÔNG phải một khuyết điểm nhẹ.
 *
 * Có những điều người duyệt bắt buộc phải thấy nhưng không có gì sai: rõ nhất là một mục tiêu của
 * khung mới đo bằng một kiến thức ĐÃ CÓ SẴN trong kho. Xếp nó vào `warning` là nói dối theo hướng
 * ngược lại — đó là dùng chung kiến thức giữa hai khung, tức là đúng mục đích của cả hệ, chứ không
 * phải chỗ cần sửa.
 */
export type IssueSeverity = 'error' | 'warning' | 'info'

export interface DraftIssue {
  readonly code:
    | 'EMPTY'
    | 'ORDERING_CYCLE'
    | 'OBJECTIVE_NO_MAPPING'
    | 'MAPPING_TARGET_MISSING'
    /** Mục tiêu đo bằng kiến thức ĐÃ CÓ trong kho — dùng chung giữa hai khung, không phải lỗi. */
    | 'OBJECTIVE_MAPS_TO_EXISTING'
    | 'ISOLATED_CONCEPT'
    | 'DUPLICATE_SLUG'
  readonly severity: IssueSeverity
  readonly message: string
  readonly refs?: readonly string[]
}

function isLearnable(kind: string): boolean {
  return kind === 'KNOWLEDGE' || kind === 'SKILL' || kind === 'DISPOSITION'
}

export interface ValidateContext {
  /**
   * Slug của kiến thức ĐÃ CÓ trong kho.
   *
   * Bước kiểm chỉ nhìn được vào lô đang xử. Trên đường đi thẳng, dedup nói được cái gì khớp vào kho
   * (`merges` với lý do `existing`) — nhưng khi bản nháp đi vòng qua trình duyệt rồi quay lại thì
   * dedup không còn, và nếu chỗ này không được cho biết gì thêm thì mọi liên kết dùng chung khung
   * đều biến thành lỗi ở đúng lần chạy thứ hai. Người gọi có kho trong tay thì đưa vào đây.
   */
  readonly existingSlugs?: ReadonlySet<string>
}

/** Trả danh sách vấn đề (error chặn publish; warning để soạn giả xem lại; info chỉ để biết). */
export function validateDraft(compiled: CompiledFramework, ctx: ValidateContext = {}): DraftIssue[] {
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
  /**
   * Kiến thức trong lô này thật ra là kiến thức ĐÃ CÓ trong kho.
   *
   * Dedup khớp một khái niệm mới vào một KC canonical có sẵn thì KC đó không được dựng lại thành
   * node — nó đã tồn tại. Cạnh MAPS_TO trỏ vào nó vì thế trỏ ra NGOÀI lô, và nếu chỗ này chỉ nhìn
   * trong lô thì nó kết luận "mục tiêu chưa ánh xạ tới đâu cả".
   *
   * Kết luận đó sai theo hướng nguy hiểm nhất: nó chặn đúng cái mà cả hệ được dựng lên để làm —
   * hai khung khác nhau cùng đo bằng một kiến thức. Chương trình thứ hai đưa vào sẽ luôn vướng, và
   * càng khớp được nhiều với vốn đã có thì càng bị chặn nhiều.
   */
  const reusedExisting = new Set<string>([
    ...compiled.dedup.merges.filter((m) => m.reason === 'existing').map((m) => m.into as string),
    ...(ctx.existingSlugs ?? []),
  ])
  const mapsToOf = new Map(compiled.objectives.map((o) => [o.slug as string, o.mapsTo as readonly string[]]))

  if (objectiveSlugs.length > 0) {
    const cov = coverageReport(sg, objectiveSlugs, new Set(), conceptSlugs)
    for (const missing of cov.missing) {
      const declared = mapsToOf.get(missing) ?? []
      const outside = declared.filter((t) => !conceptSlugs.has(t))
      const reused = outside.filter((t) => reusedExisting.has(t))
      if (declared.length > 0 && reused.length === outside.length) {
        issues.push({
          code: 'OBJECTIVE_MAPS_TO_EXISTING',
          severity: 'info',
          message: `Objective "${missing}" đo bằng kiến thức đã có trong kho (${reused.join(', ')}) — dùng chung giữa hai khung, không phải thiếu ánh xạ.`,
          refs: [missing, ...reused],
        })
        continue
      }
      const hasMapping = sg.mapsTo(missing).length > 0 || declared.length > 0
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

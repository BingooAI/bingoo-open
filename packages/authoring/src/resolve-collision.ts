// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

/**
 * NGƯỜI DUYỆT CHỐT khi máy không phân biệt được hai kiến thức.
 *
 * I1 dừng việc ghi đồ thị khi hai KC trùng khít mọi facet, và nó dừng đúng: hai kiến thức thật sự
 * khác nhau vẫn có thể ra facet giống hệt (ba nghĩa của phép trừ — đếm-lùi, lấy-đi, hiệu-số — trẻ
 * hiểu cái này mà trượt cái kia), nên tự gộp là làm hỏng xương sống bằng chứng mà không báo lỗi.
 *
 * Nhưng trên tài liệu thật thì trùng facet xảy ra thường xuyên, và trước file này người duyệt chỉ
 * ĐỌC ĐƯỢC lời cảnh báo rồi bế tắc: nút Duyệt tắt, không có lối nào đi tiếp. Một lan can không có
 * cổng thì không phải lan can, nó là bức tường — và bức tường thì người ta trèo qua bằng cách tắt
 * kiểm tra.
 *
 * Đây là cái cổng. Hai lối đầu là hai lối mà chính I1 nêu ra; hai lối sau cho những thứ khác cũng
 * chặn việc ghi và cũng chỉ người mới gỡ được:
 *
 *   GỘP        — đúng là một kiến thức. Cạnh và ánh xạ của cái bị gộp chuyển hết về cái giữ lại.
 *   PHÂN BIỆT  — là hai kiến thức khác nhau, và người duyệt NÓI RA điều gì làm chúng khác.
 *   BỎ CẠNH    — chuỗi học quay vòng (I6). Máy phát hiện được vòng nhưng KHÔNG biết mắt nào sai;
 *                chọn hộ là đoán, và một cạnh thứ tự đặt sai thì kéo lệch cả lộ trình học.
 *   BỎ MỤC     — thứ trích ra không phải một kiến thức dạy được (tiêu đề mục, câu dẫn, đặc điểm
 *                tư duy chung). Bỏ mà KHÔNG ghi lại thì "vì sao khung không có cái này" mất luôn
 *                câu trả lời — nên lý do đi kèm quyết định, không phải một nút xoá lặng lẽ.
 *
 * Thuần, tất định, không quyết định thay ai: nó chỉ THI HÀNH quyết định đã có. Không suy ra lối nào
 * nên chọn, và không tự chọn khi thiếu quyết định — vì đó lại đúng là việc I1 cấm.
 *
 * Người gọi chạy `checkInvariants` LẠI sau khi thi hành. Nếu quyết định "phân biệt" chưa thật sự
 * phân biệt (giá trị mới vẫn trùng), I1 đỏ tiếp — file này không giả vờ kiểm hộ.
 */

import type { Facets } from '@bingoo.ai/facets'
import type { GraphData, SkillEdge, SkillNode, Slug } from '@bingoo.ai/knowledge-engine'
import type { CompiledObjective } from './compile'

/**
 * Trục dùng để phân biệt. Chỉ các trục giá trị-chuỗi: `scope` là cấu trúc ({max:100}) nên sửa nó
 * bằng một chuỗi là mở đường cho dữ liệu rác — phạm vi sai thì phải trích lại, không phải vá tay.
 */
export type DistinguishAxis = 'object' | 'channel' | 'representation' | 'bloom' | 'transfer' | 'fluency'

export type CollisionDecision =
  | { readonly kind: 'merge'; readonly keep: Slug; readonly drop: Slug }
  | {
      readonly kind: 'distinguish'
      readonly slug: Slug
      readonly axis: DistinguishAxis
      readonly value: string
    }
  /** Gỡ một mắt của chuỗi quay vòng. Người duyệt chỉ ra mắt nào không đúng là thứ tự học. */
  | { readonly kind: 'drop-edge'; readonly from: Slug; readonly to: Slug; readonly relType?: string }
  /** Loại một mục không phải kiến thức dạy được. `reason` bắt buộc — bỏ thì phải nói vì sao. */
  | { readonly kind: 'drop-concept'; readonly slug: Slug; readonly reason: string }

export interface AppliedDecision {
  readonly decision: CollisionDecision
  /** Đã đổi những gì — để ghi vào sổ căn cứ và hiện lại cho người duyệt, không phải một chữ "ok". */
  readonly effect: {
    readonly nodesRemoved: readonly Slug[]
    readonly edgesRewired: number
    readonly edgesDropped: number
    readonly objectivesRewired: number
    readonly facetChanged?: { readonly axis: DistinguishAxis; readonly from?: string; readonly to: string }
    /** Lý do người duyệt nêu khi loại một mục — giữ lại để trả lời "vì sao khung không có cái này". */
    readonly reason?: string
  }
}

export interface RejectedDecision {
  readonly decision: CollisionDecision
  /** MÃ, không phải câu chữ — UI dựng câu {vi,en} (R4). */
  readonly code: 'unknown-slug' | 'same-slug' | 'not-a-concept' | 'empty-value' | 'unknown-edge'
}

export interface ResolveResult {
  readonly graph: GraphData
  readonly objectives: readonly CompiledObjective[]
  readonly applied: readonly AppliedDecision[]
  /** Quyết định KHÔNG thi hành được — báo ra, không âm thầm bỏ qua. */
  readonly rejected: readonly RejectedDecision[]
}

const edgeKey = (e: SkillEdge): string => `${e.from}→${e.to}:${e.relType}`

/**
 * Thi hành các quyết định của người duyệt lên bản nháp.
 *
 * Quyết định được áp LẦN LƯỢT: gộp A vào B rồi gộp B vào C thì kết quả đúng như người duyệt đọc từ
 * trên xuống. Thứ tự có ý nghĩa, nên hàm không tự sắp xếp lại.
 */
export function applyCollisionDecisions(
  input: { readonly graph: GraphData; readonly objectives: readonly CompiledObjective[] },
  decisions: readonly CollisionDecision[],
): ResolveResult {
  let nodes: SkillNode[] = [...input.graph.nodes]
  let edges: SkillEdge[] = [...input.graph.edges]
  let objectives: CompiledObjective[] = [...input.objectives]
  const applied: AppliedDecision[] = []
  const rejected: RejectedDecision[] = []

  for (const decision of decisions) {
    if (decision.kind === 'merge') {
      const { keep, drop } = decision
      if (keep === drop) {
        rejected.push({ decision, code: 'same-slug' })
        continue
      }
      const keepNode = nodes.find((n) => n.slug === keep)
      const dropNode = nodes.find((n) => n.slug === drop)
      if (!keepNode || !dropNode) {
        rejected.push({ decision, code: 'unknown-slug' })
        continue
      }
      // Gộp chỉ dành cho KIẾN THỨC. Mục tiêu thuộc về một khung cụ thể — gộp hai mục tiêu là trộn
      // hai khung, và đó là việc của crosswalk (qua KC nền), không phải của cổng này.
      if (keepNode.kind === 'OBJECTIVE' || dropNode.kind === 'OBJECTIVE') {
        rejected.push({ decision, code: 'not-a-concept' })
        continue
      }

      nodes = nodes.filter((n) => n.slug !== drop)

      // Chuyển cạnh sang cái giữ lại; bỏ cạnh tự-trỏ (A→A vô nghĩa) và cạnh trùng sau khi chuyển.
      const seen = new Set<string>()
      const nextEdges: SkillEdge[] = []
      let rewired = 0
      let dropped = 0
      for (const e of edges) {
        const from = e.from === drop ? keep : e.from
        const to = e.to === drop ? keep : e.to
        if (from !== e.from || to !== e.to) rewired += 1
        if (from === to) {
          dropped += 1
          continue
        }
        const moved: SkillEdge = { ...e, from, to }
        const k = edgeKey(moved)
        if (seen.has(k)) {
          dropped += 1
          continue
        }
        seen.add(k)
        nextEdges.push(moved)
      }
      edges = nextEdges

      // Mục tiêu đang đo bằng KC bị gộp thì phải trỏ sang cái giữ lại — nếu không, mục tiêu mất
      // chỗ neo và I5 sẽ coi nó là mồ côi.
      let objRewired = 0
      objectives = objectives.map((o) => {
        if (!o.mapsTo.includes(drop)) return o
        objRewired += 1
        const mapsTo = [...new Set(o.mapsTo.map((s) => (s === drop ? keep : s)))]
        return { ...o, mapsTo }
      })

      applied.push({
        decision,
        effect: {
          nodesRemoved: [drop],
          edgesRewired: rewired,
          edgesDropped: dropped,
          objectivesRewired: objRewired,
        },
      })
      continue
    }

    if (decision.kind === 'drop-edge') {
      const before = edges.length
      edges = edges.filter(
        (e) =>
          !(
            e.from === decision.from &&
            e.to === decision.to &&
            (decision.relType === undefined || e.relType === decision.relType)
          ),
      )
      if (edges.length === before) {
        rejected.push({ decision, code: 'unknown-edge' })
        continue
      }
      applied.push({
        decision,
        effect: {
          nodesRemoved: [],
          edgesRewired: 0,
          edgesDropped: before - edges.length,
          objectivesRewired: 0,
        },
      })
      continue
    }

    if (decision.kind === 'drop-concept') {
      const node = nodes.find((n) => n.slug === decision.slug)
      if (node === undefined) {
        rejected.push({ decision, code: 'unknown-slug' })
        continue
      }
      if (node.kind === 'OBJECTIVE') {
        rejected.push({ decision, code: 'not-a-concept' })
        continue
      }
      if (decision.reason.trim().length === 0) {
        rejected.push({ decision, code: 'empty-value' })
        continue
      }
      nodes = nodes.filter((n) => n.slug !== decision.slug)
      const beforeE = edges.length
      edges = edges.filter((e) => e.from !== decision.slug && e.to !== decision.slug)
      // Mục tiêu mất một mảnh nó đo bằng → phải bỏ tham chiếu, nếu không I5 coi nó là mồ côi.
      let objRewired = 0
      objectives = objectives.map((o) => {
        if (!o.mapsTo.includes(decision.slug)) return o
        objRewired += 1
        return { ...o, mapsTo: o.mapsTo.filter((t) => t !== decision.slug) }
      })
      applied.push({
        decision,
        effect: {
          nodesRemoved: [decision.slug],
          edgesRewired: 0,
          edgesDropped: beforeE - edges.length,
          objectivesRewired: objRewired,
          reason: decision.reason.trim(),
        },
      })
      continue
    }

    // ── PHÂN BIỆT ────────────────────────────────────────────────────────────────────────────────
    const { slug, axis, value } = decision
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      rejected.push({ decision, code: 'empty-value' })
      continue
    }
    const idx = nodes.findIndex((n) => n.slug === slug)
    const node = nodes[idx]
    if (idx < 0 || node === undefined) {
      rejected.push({ decision, code: 'unknown-slug' })
      continue
    }
    const facets = (node.facets ?? {}) as Facets
    const before = facets[axis]
    nodes = nodes.map((n, i) =>
      i === idx ? { ...n, facets: { ...facets, [axis]: trimmed } as SkillNode['facets'] } : n,
    )
    applied.push({
      decision,
      effect: {
        nodesRemoved: [],
        edgesRewired: 0,
        edgesDropped: 0,
        objectivesRewired: 0,
        facetChanged: {
          axis,
          ...(typeof before === 'string' ? { from: before } : {}),
          to: trimmed,
        },
      },
    })
  }

  return { graph: { nodes, edges }, objectives, applied, rejected }
}

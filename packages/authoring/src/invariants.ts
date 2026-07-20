/**
 * BẤT BIẾN CHẠY ĐƯỢC — không phải văn xuôi.
 *
 * Vì sao tồn tại: 6 lỗi tìm được khi chạy curriculum thật (Cambridge + MOET) đều là MỘT lỗi —
 * một câu hỏi về NGỮ NGHĨA/ĐỊNH DANH bị trả lời ngầm bằng một cơ chế tình cờ (slug từ câu chữ,
 * stage gắn lên KC, ngưỡng trigram, trung bình khi certify…). Vá từng cái thì vô tận.
 * Bất biến không chạy được thì KHÔNG PHẢI bất biến — chỉ là ý định.
 *
 * Chạy TRƯỚC MỌI lần ghi đồ thị (/apply) và trong CI trên fixture nguồn thật.
 */

import { compareIdentity, facetKey, type DomainProfile, type Facets } from '@bingoo.ai/facets'
import type { GraphData, SkillNode, Slug } from '@bingoo.ai/knowledge-engine'

export type InvariantCode =
  | 'I1_IDENTITY_COLLISION'
  | 'I2_FRAMEWORK_LABEL_ON_KC'
  | 'I3_OBJECTIVE_NOT_MEASURABLE'
  | 'I4_MAPS_TO_NOT_REQUIRED'
  | 'I5_ORPHAN_OBJECTIVE'
  | 'I6_ORDERING_CYCLE'
  | 'I7_MISSING_CANONICAL_EN'
  | 'I8_MISSING_REQUIRED_FACET'

export interface Violation {
  readonly code: InvariantCode
  readonly severity: 'error' | 'warning'
  readonly message: string
  readonly slugs: readonly Slug[]
}

export interface InvariantOpts {
  /** subject → hồ sơ môn (DỮ LIỆU: trục bắt buộc, alias). Thiếu hồ sơ thì I8 không chạy. */
  readonly profiles?: Readonly<Record<string, DomainProfile>>
  /** Đã có sẵn trong đồ thị (để bắt trùng định danh với KC cũ, không chỉ trong lô). */
  readonly existing?: readonly SkillNode[]
}

const ORDERING = new Set(['PREREQUISITE', 'ENABLES', 'COMPOSES'])
const isKc = (n: SkillNode): boolean => n.kind !== 'OBJECTIVE'
const facetsOf = (n: SkillNode): Facets => (n.facets ?? {}) as Facets

/**
 * I6 — cạnh thứ tự phải acyclic. (Kiểm tại đây luôn để invariants là MỘT cổng duy nhất,
 * không phải rải rác nhiều chỗ.)
 */
function findCycle(nodes: readonly SkillNode[], graph: GraphData): Slug[] | null {
  const adj = new Map<Slug, Slug[]>()
  for (const n of nodes) adj.set(n.slug, [])
  for (const e of graph.edges) {
    if (!ORDERING.has(e.relType ?? 'PREREQUISITE')) continue
    adj.get(e.from)?.push(e.to)
  }
  const state = new Map<Slug, 0 | 1 | 2>()
  const stack: Slug[] = []
  let cycle: Slug[] | null = null

  const dfs = (u: Slug): void => {
    if (cycle) return
    state.set(u, 1)
    stack.push(u)
    for (const v of adj.get(u) ?? []) {
      if (cycle) return
      const st = state.get(v) ?? 0
      if (st === 1) {
        cycle = [...stack.slice(stack.indexOf(v)), v]
        return
      }
      if (st === 0) dfs(v)
    }
    stack.pop()
    state.set(u, 2)
  }
  for (const n of nodes) if ((state.get(n.slug) ?? 0) === 0) dfs(n.slug)
  return cycle
}

/** Chạy toàn bộ bất biến trên một đồ thị sắp ghi. `error` = CHẶN, không được ghi. */
export function checkInvariants(graph: GraphData, opts: InvariantOpts = {}): Violation[] {
  const v: Violation[] = []
  const add = (
    code: InvariantCode,
    severity: Violation['severity'],
    message: string,
    slugs: Slug[],
  ): void => {
    v.push({ code, severity, message, slugs })
  }

  const nodes = graph.nodes
  const kcs = nodes.filter(isKc)
  const objectives = nodes.filter((n) => !isKc(n))

  // ── I7: TIẾNG ANH LÀ GỐC — mọi title phải có `en` (slug/định danh mint từ nó).
  for (const n of nodes) {
    if (!n.title['en']?.trim()) {
      add(
        'I7_MISSING_CANONICAL_EN',
        'error',
        `"${n.slug}" thiếu title.en — tiếng Anh là bản gốc, slug mint từ nó.`,
        [n.slug],
      )
    }
  }

  // ── I2: nhãn RIÊNG CỦA KHUNG (stage) chỉ được nằm trên OBJECTIVE.
  // Cùng một KC ("add within 20") nằm ở Cambridge Stage 2 VÀ Lớp 1 Việt Nam — KC không thể có 1 stage.
  for (const n of kcs) {
    if (n.stage !== undefined) {
      add(
        'I2_FRAMEWORK_LABEL_ON_KC',
        'error',
        `KC "${n.slug}" mang stage="${n.stage}". stage là nhãn RIÊNG của từng khung → chỉ được đặt trên OBJECTIVE.`,
        [n.slug],
      )
    }
  }

  // ── I8: trục facet BẮT BUỘC của môn phải được khai (nếu có hồ sơ môn).
  for (const n of kcs) {
    const profile = n.subject ? opts.profiles?.[n.subject] : undefined
    if (!profile) continue
    const f = facetsOf(n)
    const missing = profile.requiredAxes.filter((ax) => f[ax] === undefined)
    if (missing.length > 0) {
      add(
        'I8_MISSING_REQUIRED_FACET',
        'error',
        `KC "${n.slug}" (${n.subject}) thiếu trục bắt buộc: ${missing.join(', ')} — không có nó thì không phân biệt được với KC khác.`,
        [n.slug],
      )
    }
  }

  // ── I1: MỘT kiến thức ⇔ MỘT slug. Trùng định danh (cùng facets) = KC trùng.
  // So bằng CẤU TRÚC, không bằng ngưỡng chuỗi.
  const all = [...(opts.existing ?? []), ...kcs]
  const byKey = new Map<string, SkillNode[]>()
  for (const n of all) {
    const f = facetsOf(n)
    if (Object.keys(f).length === 0) continue // chưa khai facet → I8 lo, không kết luận ở đây
    const key = `${n.subject ?? '?'}#${facetKey(f)}`
    byKey.set(key, [...(byKey.get(key) ?? []), n])
  }
  for (const group of byKey.values()) {
    if (group.length < 2) continue
    const profile = group[0]?.subject ? opts.profiles?.[group[0].subject as string] : undefined
    const [a, ...rest] = group
    for (const b of rest) {
      if (!a) break
      const r = compareIdentity(facetsOf(a), facetsOf(b), profile)
      if (r.verdict === 'SAME') {
        // KHÔNG khẳng định "chúng là một" — máy chỉ biết là nó KHÔNG PHÂN BIỆT ĐƯỢC.
        // Hai KC thật sự khác nhau vẫn có thể ra facets giống hệt (vd 3 nghĩa của phép trừ:
        // đếm-lùi / lấy-đi / hiệu-số — trẻ hiểu cái này mà trượt cái kia → LÀ 2 KC khác nhau).
        // Nên đây là CỔNG NGƯỜI DUYỆT, không phải phán quyết của máy: hoặc gộp, hoặc bổ sung
        // facet phân biệt. Tự gộp = làm hỏng vĩnh viễn xương sống bằng chứng mà không báo lỗi.
        add(
          'I1_IDENTITY_COLLISION',
          'error',
          `KHÔNG PHÂN BIỆT ĐƯỢC "${a.slug}" với "${b.slug}": trùng khít mọi facet (${r.axes.join(', ')}). ` +
            'Người duyệt phải chốt — (a) đúng là MỘT kiến thức → gộp làm một KC, hoặc ' +
            '(b) là HAI kiến thức khác nhau → bổ sung facet phân biệt (thường là "object" mịn hơn, ' +
            'hoặc "representation"/"scope"). Máy KHÔNG tự gộp: gộp sai làm hỏng bằng chứng vĩnh viễn.',
          [a.slug, b.slug],
        )
      }
    }
  }

  // ── I4/I5: OBJECTIVE phải neo vào ≥1 KC, và cạnh MAPS_TO phải REQUIRED (đạt = AND, không phải trung bình).
  const mapsToBy = new Map<Slug, { to: Slug; mode: string }[]>()
  for (const e of graph.edges) {
    if ((e.relType ?? '') !== 'MAPS_TO') continue
    mapsToBy.set(e.from, [...(mapsToBy.get(e.from) ?? []), { to: e.to, mode: e.mode }])
  }
  for (const o of objectives) {
    const m = mapsToBy.get(o.slug) ?? []
    if (m.length === 0) {
      add(
        'I5_ORPHAN_OBJECTIVE',
        'error',
        `OBJECTIVE "${o.slug}" không MAPS_TO KC nào — không thể chứng nhận bằng bằng chứng nào.`,
        [o.slug],
      )
      continue
    }
    const soft = m.filter((x) => x.mode !== 'REQUIRED')
    if (soft.length > 0) {
      add(
        'I4_MAPS_TO_NOT_REQUIRED',
        'warning',
        `OBJECTIVE "${o.slug}" có ${soft.length} cạnh MAPS_TO không REQUIRED → sẽ chứng nhận bằng TRUNG BÌNH, có thể "đạt" khi còn thiếu mắt xích.`,
        [o.slug],
      )
    }
  }

  // ── I3: OBJECTIVE không được là nơi fold bằng chứng (chỉ KC mới có mastery).
  for (const o of objectives) {
    if (o.facets !== undefined) {
      add(
        'I3_OBJECTIVE_NOT_MEASURABLE',
        'warning',
        `OBJECTIVE "${o.slug}" mang facets — facets là để định danh KC; objective chỉ là phát biểu của khung.`,
        [o.slug],
      )
    }
  }

  // ── I6: DAG.
  const cycle = findCycle(nodes, graph)
  if (cycle) {
    add('I6_ORDERING_CYCLE', 'error', `Chu trình tiên quyết: ${cycle.join(' → ')}`, cycle)
  }

  return v
}

export function hasBlockingViolation(v: readonly Violation[]): boolean {
  return v.some((x) => x.severity === 'error')
}

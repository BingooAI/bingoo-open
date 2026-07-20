/**
 * DERIVED INSIGHTS cho kế hoạch — KHÔNG author, TÍNH từ competency graph. Trả lời câu hỏi "giáo án
 * xây KIẾN THỨC gì, KỸ NĂNG gì, PHẨM CHẤT gì, phục vụ MỤC TIÊU nào, cần TIÊN QUYẾT gì" ở CẢ 3 cấp
 * (khoá / unit / bài) — vì mọi thứ đó đã nằm sẵn trong graph:
 *   · phân loại tri thức  → node.kind (KNOWLEDGE / SKILL / PROCEDURE / DISPOSITION / ATTITUDE / …)
 *   · mục tiêu (objective) → cạnh MAPS_TO (objective → KC), đọc ngược
 *   · tiên quyết          → cạnh prereq (KC nền của KC trong cấp mà cấp KHÔNG tự dạy)
 *
 * Author lại những thứ này = tạo nguồn sự thật thứ hai, lệch khi ai đó sửa graph. Nên: DERIVE.
 */

import { buildGraph, type SkillGraph, type Slug } from '@bingoo.ai/knowledge-engine'
import { loadGraphData } from '../repos/knowledge.repo'
import { getCourse } from '../repos/course.repo'
import { listPlans } from '../repos/plan-hierarchy.repo'
import { AppError } from '../lib/errors'

export type PlanLevel = 'course' | 'unit' | 'lesson'
type Loc = Record<string, string>

export interface KcRef {
  readonly slug: string
  readonly title: Loc
  readonly kind: string
}
export interface KindGroup {
  readonly kind: string
  readonly items: readonly KcRef[]
}
/** Một hiểu-sai gom từ kế hoạch bài (KP.misconceptions) — để soát pedagogy + mồi distractor. */
export interface MisconceptionRef {
  readonly kc: string
  readonly type: string // conceptual | procedural | incomplete | formatting
  readonly wrong: Loc
  readonly lessonSlug: string
}
/** Bằng chứng đánh giá cho một concept — bài nào đo, bao nhiêu item, hình thức gì (UbD Stage 2). */
export interface EvidenceRef {
  readonly concept: string
  readonly title: Loc
  readonly itemCount: number
  readonly modes: readonly string[] // LEARN | MEASURE
  readonly lessons: readonly string[]
}

export interface LevelInsights {
  readonly level: PlanLevel
  readonly refSlug: string
  readonly kcCount: number
  /** KC được cấp này dạy, NHÓM theo loại tri thức (knowledge/skill/procedure/disposition/…). */
  readonly byKind: readonly KindGroup[]
  /** Mục tiêu (khung) mà các KC này phục vụ — đọc ngược MAPS_TO. */
  readonly objectives: readonly KcRef[]
  /** Tiên quyết: KC nền của các KC trong cấp mà cấp KHÔNG tự dạy (phải biết trước khi vào). */
  readonly prerequisites: readonly KcRef[]
  /** Hiểu-sai gom từ các kế hoạch BÀI đã sinh trong cấp (rỗng nếu chưa sinh bài). */
  readonly misconceptions: readonly MisconceptionRef[]
  /** Bản đồ bằng chứng: concept → bài đo + số item (từ blueprint của bài đã sinh). */
  readonly evidence: readonly EvidenceRef[]
}

// Thứ tự hiển thị các loại tri thức — nền (biết) → vận dụng (làm) → con người (phẩm chất).
const KIND_ORDER = [
  'KNOWLEDGE',
  'SKILL',
  'PROCEDURE',
  'DISPOSITION',
  'ATTITUDE',
  'BEHAVIOR',
  'OUTCOME',
  'OBJECTIVE',
] as const
// Loại "mục tiêu/đầu ra" không phải KC được DẠY — tách riêng, không xếp vào byKind.
const OBJECTIVE_KINDS = new Set(['OBJECTIVE', 'OUTCOME'])

const kindRank = (k: string): number => {
  const i = (KIND_ORDER as readonly string[]).indexOf(k)
  return i === -1 ? KIND_ORDER.length : i
}

/** Phạm vi một cấp: KC nó DẠY + các BÀI thuộc cấp (để gom hiểu-sai/bằng chứng từ kế hoạch bài). */
async function scopeForLevel(
  courseSlug: string,
  level: PlanLevel,
  refSlug: string,
): Promise<{ kcs: Slug[]; lessonSlugs: string[] }> {
  const course = await getCourse(courseSlug)
  if (!course) throw AppError.notFound('Không có khoá này.')
  const units = course.plan.units

  let lessons
  if (level === 'course') {
    lessons = units.flatMap((u) => u.lessons)
  } else if (level === 'unit') {
    const u = units.find((x) => x.slug === refSlug)
    if (!u) throw AppError.notFound('Không có unit này trong khoá.')
    lessons = u.lessons
  } else {
    const l = units.flatMap((u) => u.lessons).find((x) => x.slug === refSlug)
    if (!l) throw AppError.notFound('Không có bài này trong khoá.')
    lessons = [l]
  }
  return {
    kcs: [...new Set(lessons.flatMap((l) => l.teaches))],
    lessonSlugs: lessons.map((l) => l.slug),
  }
}

const toRef = (graph: SkillGraph, slug: Slug): KcRef => {
  const n = graph.node(slug)
  return { slug, title: (n?.title ?? {}) as Loc, kind: n?.kind ?? 'KNOWLEDGE' }
}

/** Nhóm KC theo kind, xếp theo KIND_ORDER; bỏ nhóm rỗng. */
function groupByKind(refs: KcRef[]): KindGroup[] {
  const map = new Map<string, KcRef[]>()
  for (const r of refs) {
    if (OBJECTIVE_KINDS.has(r.kind)) continue // objective tách riêng
    ;(map.get(r.kind) ?? map.set(r.kind, []).get(r.kind)!).push(r)
  }
  return [...map.entries()]
    .map(([kind, items]) => ({ kind, items: items.sort((a, b) => a.slug.localeCompare(b.slug)) }))
    .sort((a, b) => kindRank(a.kind) - kindRank(b.kind))
}

/**
 * Insights cho một cấp. Load graph một lần; group theo kind; objective = ngược MAPS_TO; prereq = KC nền
 * ngoài tập cấp. Thuần đọc — không ghi gì.
 */
export async function deriveLevelInsights(
  courseSlug: string,
  level: PlanLevel,
  refSlug: string,
): Promise<LevelInsights> {
  const [scope, graph, plans] = await Promise.all([
    scopeForLevel(courseSlug, level, refSlug),
    loadGraphData().then((d) => buildGraph(d)),
    listPlans(courseSlug),
  ])
  const { kcs, lessonSlugs } = scope

  const inSet = new Set(kcs)
  const taught = kcs.filter((k) => graph.has(k)).map((k) => toRef(graph, k))

  // Objectives: cạnh MAPS_TO có `to` là KC của cấp → đọc `from` (objective). Dedupe.
  const objSlugs = new Set<Slug>()
  for (const kc of kcs) for (const e of graph.lateralOf(kc, 'MAPS_TO')) if (e.to === kc) objSlugs.add(e.from)

  // Prerequisites: KC nền (prereqsOf → `.from`) NGOÀI tập cấp, có trong graph. Dedupe.
  const preSlugs = new Set<Slug>()
  for (const kc of kcs)
    for (const e of graph.prereqsOf(kc)) if (!inSet.has(e.from) && graph.has(e.from)) preSlugs.add(e.from)

  const byName = (a: KcRef, b: KcRef) => (a.title.en ?? a.slug).localeCompare(b.title.en ?? b.slug)

  // ── Từ các kế hoạch BÀI đã sinh trong phạm vi cấp: gom HIỂU-SAI + BẰNG CHỨNG (rỗng nếu chưa sinh) ──
  const lessonSet = new Set(lessonSlugs)
  const lessonDocs = plans
    .filter((p) => p.level === 'lesson' && lessonSet.has(p.refSlug))
    .map((p) => ({ slug: p.refSlug, doc: (p.doc ?? {}) as LessonDoc }))

  const misconceptions: MisconceptionRef[] = []
  const evMap = new Map<string, { itemCount: number; modes: Set<string>; lessons: Set<string> }>()
  for (const { slug, doc } of lessonDocs) {
    for (const kp of doc.knowledgePoints ?? []) {
      for (const m of kp.misconceptions ?? []) {
        if (!m?.wrong) continue
        misconceptions.push({
          kc: m.targetsKc ?? kp.targets?.[0] ?? '',
          type: m.type ?? 'conceptual',
          wrong: m.wrong,
          lessonSlug: slug,
        })
      }
    }
    const mode = doc.assessment?.mode
    for (const b of doc.assessment?.blueprint ?? []) {
      if (!b?.concept) continue
      const e = evMap.get(b.concept) ?? {
        itemCount: 0,
        modes: new Set<string>(),
        lessons: new Set<string>(),
      }
      e.itemCount += typeof b.itemCount === 'number' ? b.itemCount : 0
      if (mode) e.modes.add(mode)
      e.lessons.add(slug)
      evMap.set(b.concept, e)
    }
  }
  const evidence: EvidenceRef[] = [...evMap.entries()]
    .map(([concept, e]) => ({
      concept,
      title: (graph.node(concept)?.title ?? {}) as Loc,
      itemCount: e.itemCount,
      modes: [...e.modes],
      lessons: [...e.lessons],
    }))
    .sort((a, b) => a.concept.localeCompare(b.concept))

  return {
    level,
    refSlug,
    kcCount: taught.length,
    byKind: groupByKind(taught),
    objectives: [...objSlugs].map((s) => toRef(graph, s)).sort(byName),
    prerequisites: [...preSlugs].map((s) => toRef(graph, s)).sort(byName),
    misconceptions,
    evidence,
  }
}

// Shape TỐI THIỂU đọc từ doc kế hoạch bài (LessonInstructionPlan) — chỉ field ta cần, đọc lỏng.
interface LessonDoc {
  readonly knowledgePoints?: readonly {
    readonly targets?: readonly string[]
    readonly misconceptions?: readonly {
      readonly type?: string
      readonly wrong?: Loc
      readonly targetsKc?: string
    }[]
  }[]
  readonly assessment?: {
    readonly mode?: string
    readonly blueprint?: readonly { readonly concept?: string; readonly itemCount?: number }[]
  }
}

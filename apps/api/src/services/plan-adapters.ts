/**
 * Sinh Instruction Plan (S4): tập KC → LessonInstructionPlan bằng LLM, coerce về đúng shape
 * (plans dùng TS interface, không Zod) rồi planQuality kiểm sư phạm. Adapter TỰ ép cấu trúc hợp lệ.
 */

import type {
  ActivityPlan,
  AssessmentPlan,
  BlueprintEntry,
  KcArc,
  KnowledgePoint,
  LessonInstructionPlan,
  LessonStep,
  LocalizedText,
  Misconception,
  Representation,
  StepDeliveryKind,
  SuccessCriterion,
} from '@bingoo.ai/plans'
import type { Slug } from '@bingoo.ai/knowledge-engine'
import { contentReadyPrimitives } from './primitive-info.service'

/**
 * Catalogue SẴN SÀNG SINH (kit đã khai đáp án + quiz), có chú thích (họ + "học sinh làm gì") — đưa vào
 * prompt sinh PLAN để nó chọn primitiveKinds HỢP + SINH ĐƯỢC cho từng step. Chỉ liệt kê loại chấm được
 * ngay → plan không gợi ý kit chưa hỗ trợ (tránh lỗi "chưa có hợp đồng đáp án"). Tính một lần (static).
 */
const PRIMITIVE_CATALOGUE = contentReadyPrimitives()
  .map((p) => `${p.kind} — ${p.family} — ${p.desc?.en ?? p.label.en}`)
  .join('\n')
import { getAi } from '../providers'
import { readEnv } from '../providers/core/config'
import { renderPrompt } from '../prompts'

/**
 * CHI PHÍ: tách model cho khâu sinh nội dung. Mặc định Sonnet (nội dung học cần chất lượng hơn
 * trích xuất, nhưng KHÔNG cần Opus). Đổi bằng env `CONTENT_MODEL`, không đụng code.
 */
const CONTENT_MODEL = readEnv('CONTENT_MODEL') ?? 'claude-sonnet-5'

const MIS_TYPES = ['conceptual', 'procedural', 'incomplete', 'formatting'] as const
const STAGES = ['concrete', 'pictorial', 'abstract'] as const
const BANDS = ['easy', 'core', 'stretch'] as const
const PURPOSES = ['teach', 'practice', 'assess'] as const
const DELIVERY: readonly StepDeliveryKind[] = ['explainer', 'content', 'practice', 'assessment', 'reflection']
const STATES = ['novice', 'gap', 'proficient', 'mastered'] as const
const FLUENCY = ['emerging', 'accurate', 'fluent', 'automatic'] as const

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const strArr = (v: unknown): string[] =>
  arr(v)
    .map(str)
    .filter((s): s is string => s !== undefined)

function loc(v: unknown, fallback = ''): LocalizedText {
  const o = rec(v)
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(o)) if (typeof val === 'string' && val.trim()) out[k] = val.trim()
  return Object.keys(out).length ? out : { en: fallback, vi: fallback }
}

function firstJson(text: string): Record<string, unknown> {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return {}
  try {
    return rec(JSON.parse(m[0]))
  } catch {
    return {}
  }
}

function sanitizeKP(raw: unknown, index: number, kcs: readonly Slug[]): KnowledgePoint {
  const o = rec(raw)
  const targets = strArr(o.targets)
  const finalTargets = targets.length ? targets : [kcs[index % Math.max(1, kcs.length)] ?? kcs[0] ?? 'kc']

  const misconceptions: Misconception[] = arr(o.misconceptions).map((m, i) => {
    const mo = rec(m)
    const type = MIS_TYPES.includes(mo.type as (typeof MIS_TYPES)[number])
      ? (mo.type as Misconception['type'])
      : 'conceptual'
    return {
      id: str(mo.id) ?? `mis-${index}-${i}`,
      type,
      wrong: loc(mo.wrong),
      targetsKc: str(mo.targetsKc) ?? finalTargets[0] ?? 'kc',
      ...(mo.diagnostic ? { diagnostic: loc(mo.diagnostic) } : {}),
      ...(mo.remediation ? { remediation: loc(mo.remediation) } : {}),
    }
  })

  const representations: Representation[] = arr(o.representations).map((r) => {
    const ro = rec(r)
    const stage = STAGES.includes(ro.stage as (typeof STAGES)[number])
      ? (ro.stage as Representation['stage'])
      : 'pictorial'
    return { stage, model: loc(ro.model), ...(ro.note ? { note: loc(ro.note) } : {}) }
  })

  const successCriteria: SuccessCriterion[] = arr(o.successCriteria).map((s) => {
    const so = rec(s)
    return { text: loc(so.text), ...(str(so.kc) ? { kc: str(so.kc) } : {}) }
  })

  return {
    slug: str(o.slug) ?? `kp-${index}`,
    version: 1,
    targets: finalTargets,
    misconceptions,
    representations,
    successCriteria,
  }
}

function sanitizeBlueprint(raw: unknown, teaches: readonly Slug[]): BlueprintEntry[] {
  const entries = arr(raw).map((b) => {
    const o = rec(b)
    const concept = str(o.concept)
    if (!concept) return undefined
    const difficulty = BANDS.includes(o.difficulty as (typeof BANDS)[number])
      ? (o.difficulty as BlueprintEntry['difficulty'])
      : undefined
    const count = typeof o.itemCount === 'number' && o.itemCount > 0 ? Math.floor(o.itemCount) : 3
    return {
      concept,
      itemCount: count,
      ...(difficulty ? { difficulty } : {}),
      ...(str(o.primitiveKind) ? { primitiveKind: str(o.primitiveKind) } : {}),
    }
  })
  const out = entries.filter((e): e is BlueprintEntry => e !== undefined)
  // Đảm bảo mọi KC dạy đều có mục đo (ASSESS-TAUGHT / COVERAGE).
  for (const kc of teaches)
    if (!out.some((e) => e.concept === kc)) out.push({ concept: kc, itemCount: 3, difficulty: 'core' })
  return out
}

/** Một bước — role mở, deliveryKind thuộc tập biết, thời lượng kẹp [1,60] (chống LLM ghi 999/0). */
function sanitizeStep(raw: unknown, i: number): LessonStep | undefined {
  const o = rec(raw)
  const role = str(o.role)
  if (!role) return undefined // bước vô-vai-trò là rác
  const deliveryKind = DELIVERY.includes(o.deliveryKind as StepDeliveryKind)
    ? (o.deliveryKind as StepDeliveryKind)
    : 'content'
  const dRaw = typeof o.durationMin === 'number' ? o.durationMin : Number(o.durationMin)
  const durationMin = Number.isFinite(dRaw) ? Math.min(60, Math.max(1, Math.round(dRaw))) : 5
  const band = BANDS.includes(o.band as (typeof BANDS)[number]) ? (o.band as LessonStep['band']) : undefined
  const primitiveKinds = strArr(o.primitiveKinds)
  const itemCount = typeof o.itemCount === 'number' && o.itemCount > 0 ? Math.floor(o.itemCount) : undefined
  const mustCover = arr(o.mustCover)
    .map((m) => loc(m))
    .filter((l) => (l.en ?? '').length > 0 || (l.vi ?? '').length > 0)
  // forStates: chỉ giữ trạng thái HỢP LỆ (taxonomy đóng); rỗng → nhánh mặc định (mọi trạng thái).
  const forStates = strArr(o.forStates).filter((s): s is (typeof STATES)[number] =>
    STATES.includes(s as (typeof STATES)[number]),
  )
  return {
    slug: str(o.slug) ?? `step-${i}`,
    role,
    title: loc(o.title, role),
    ...(o.intent ? { intent: loc(o.intent) } : {}),
    durationMin,
    deliveryKind,
    ...(forStates.length ? { forStates } : {}),
    ...(o.brief ? { brief: loc(o.brief) } : {}),
    ...(mustCover.length ? { mustCover } : {}),
    ...(primitiveKinds.length ? { primitiveKinds } : {}),
    ...(itemCount !== undefined ? { itemCount } : {}),
    ...(band ? { band } : {}),
  }
}

/**
 * CẤU TRÚC bài — MỖI KC MỘT CHUỖI (arc), không gộp. Chỉ nhận arc của KC CÓ THẬT trong bài; nếu LLM
 * lồng nhiều KC vào một bước, ta bỏ qua vì model không còn `targets` — arc buộc thuộc đúng một KC.
 * Không tự-chế arc cho KC bị thiếu (để planQuality cảnh báo KC_NO_ARC — người soạn thấy để sinh lại).
 */
export function sanitizeKcArcs(raw: unknown, teaches: readonly Slug[]): KcArc[] {
  const known = new Set(teaches)
  const seen = new Set<Slug>()
  const out: KcArc[] = []
  for (const a of arr(raw)) {
    const o = rec(a)
    const kc = str(o.kc) as Slug | undefined
    if (!kc || !known.has(kc) || seen.has(kc)) continue // chỉ KC thật, mỗi KC một arc
    seen.add(kc)
    const steps = arr(o.steps)
      .map((s, i) => sanitizeStep(s, i))
      .filter((s): s is LessonStep => s !== undefined)
    // exit: ngưỡng thoát KC (mastery/fluency) — kẹp mastery [0,1], fluency theo enum.
    const eo = rec(o.exit)
    const mRaw = typeof eo.masteryMin === 'number' ? eo.masteryMin : Number(eo.masteryMin)
    const masteryMin = Number.isFinite(mRaw) ? Math.min(1, Math.max(0, mRaw)) : undefined
    const fluencyMin = FLUENCY.includes(eo.fluencyMin as (typeof FLUENCY)[number])
      ? (eo.fluencyMin as (typeof FLUENCY)[number])
      : undefined
    const exit =
      masteryMin !== undefined || fluencyMin !== undefined
        ? {
            ...(masteryMin !== undefined ? { masteryMin } : {}),
            ...(fluencyMin ? { fluencyMin } : {}),
          }
        : undefined
    out.push({
      kc,
      ...(o.title ? { title: loc(o.title) } : {}),
      steps,
      ...(exit ? { exit } : {}),
    })
  }
  return out
}

function sanitizeActivities(raw: unknown): ActivityPlan[] {
  return arr(raw)
    .map((a, i): ActivityPlan | undefined => {
      const o = rec(a)
      const purpose = PURPOSES.includes(o.purpose as (typeof PURPOSES)[number])
        ? (o.purpose as ActivityPlan['purpose'])
        : undefined
      if (!purpose) return undefined
      const band = BANDS.includes(o.difficultyBand as (typeof BANDS)[number])
        ? (o.difficultyBand as ActivityPlan['difficultyBand'])
        : undefined
      return {
        slug: str(o.slug) ?? `act-${i}`,
        purpose,
        primitiveKinds: strArr(o.primitiveKinds),
        concepts: strArr(o.concepts),
        ...(band ? { difficultyBand: band } : {}),
        ...(typeof o.itemCount === 'number' && o.itemCount > 0 ? { itemCount: Math.floor(o.itemCount) } : {}),
      }
    })
    .filter((a): a is ActivityPlan => a !== undefined)
}

/** LLM → LessonInstructionPlan (đã coerce hợp lệ cấu trúc). */
export async function generateLessonPlan(input: {
  kcs: readonly Slug[]
  language: string
  /** Trình độ đích để LLM thiết kế cấu trúc hợp lý (gợi ý, không làm plan lệ thuộc level). */
  level?: string
  /** Context cấp trên ĐÃ DUYỆT — grounding, chống bịa. JSON chuỗi hoá; rỗng nếu chưa có. */
  courseContext?: string
  unitContext?: string
  aiKey?: string
  /** Cho phép HỦY (job nền) — luồn xuống LLM call. */
  signal?: AbortSignal
}): Promise<LessonInstructionPlan> {
  const res = await getAi(input.aiKey).generateText({
    ...(input.signal ? { signal: input.signal } : {}),
    system: await renderPrompt('plan.lesson.generate', {
      kcs: input.kcs.join(', '),
      language: input.language,
      level: input.level ?? 'mixed (design a balanced structure)',
      courseContext: input.courseContext ?? '(none — design from the KCs alone)',
      unitContext: input.unitContext ?? '(none)',
      // Catalogue ĐẦY ĐỦ (kit+quiz+mô tả) → plan tự chọn primitiveKinds hợp cho từng step.
      catalogue: PRIMITIVE_CATALOGUE,
    }),
    messages: [{ role: 'user', content: `KCs=${input.kcs.join(', ')}` }],
    model: CONTENT_MODEL,
    // Kế hoạch giờ giàu: kcArcs (mỗi KC một chuỗi bước ~4k token) + brief/mustCover/forStates mỗi bước
    // + KP + assessment. maxTokens là TRẦN, chỉ trả tiền token THỰC sinh — nới cao không tốn thêm khi
    // output ngắn, chỉ cứu bài nhiều KC khỏi bị cắt. ~4 KC là kịch trần thực tế; đông hơn nên TÁCH bài.
    maxTokens: 16000,
  })
  if (res.finishReason === 'max_tokens') {
    throw new Error('Sinh kế hoạch bị CẮT vì hết token — bài quá nhiều KC, hãy tách bớt.')
  }
  const o = firstJson(res.text)

  const teaches = strArr(o.teaches).length ? strArr(o.teaches) : [...input.kcs]
  const kps = arr(o.knowledgePoints).map((kp, i) => sanitizeKP(kp, i, input.kcs))
  // Mọi KC phải được ≥1 KP nhắm (ANCHOR/COVERAGE).
  const targeted = new Set(kps.flatMap((kp) => kp.targets))
  input.kcs.forEach((kc, i) => {
    if (!targeted.has(kc))
      kps.push(sanitizeKP({ slug: `kp-auto-${i}`, targets: [kc] }, kps.length, input.kcs))
  })

  const ao = rec(o.assessment)
  const assessment: AssessmentPlan = {
    slug: str(ao.slug) ?? 'assess-1',
    mode: ao.mode === 'MEASURE' ? 'MEASURE' : 'LEARN',
    objectives: strArr(ao.objectives).length ? strArr(ao.objectives) : teaches,
    blueprint: sanitizeBlueprint(ao.blueprint, teaches),
  }

  const prerequisites = strArr(o.prerequisites)
  const kcArcs = sanitizeKcArcs(o.kcArcs, teaches)

  return {
    slug: str(o.slug) ?? `lesson-${teaches[0] ?? 'x'}`,
    version: 1,
    title: loc(o.title, teaches.join(', ')),
    teaches,
    ...(prerequisites.length ? { prerequisites } : {}),
    knowledgePoints: kps,
    ...(kcArcs.length ? { kcArcs } : {}),
    activities: sanitizeActivities(o.activities),
    assessment,
  }
}

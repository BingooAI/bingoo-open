// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Sinh KẾ HOẠCH PHÂN CẤP — Khoá → Unit → (Bài ở plan-generate.service). Context của cấp cha ĐÃ DUYỆT
 * chảy xuống cấp con để LLM hiểu tổng thể (chống bịa). CỔNG: chưa duyệt cha thì KHÔNG sinh con.
 */

import type { CoursePlanDoc, UnitPlanDoc } from '@bingoo.ai/plans'
import { coursePlanQuality, unitPlanQuality } from '@bingoo.ai/plans'
import { getAi } from '../providers'
import { promptFingerprint, renderPrompt } from '../prompts'
import { getCourse } from '../repos/course.repo'
import { getPlan, isApproved, savePlan, type StoredPlan } from '../repos/plan-hierarchy.repo'
import { AppError } from '../lib/errors'
import { modelFor } from '../config/models'
import { parseModelJson } from '../lib/model-json'

// ── coerce helpers (plans là TS interface, không Zod) ────────────────────────
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const strArr = (v: unknown): string[] =>
  arr(v)
    .map(str)
    .filter((s): s is string => s !== undefined)

type Loc = Record<string, string>
function loc(v: unknown, fallback = ''): Loc {
  const o = rec(v)
  const out: Loc = {}
  for (const [k, val] of Object.entries(o)) if (typeof val === 'string' && val.trim()) out[k] = val.trim()
  return Object.keys(out).length ? out : { en: fallback, vi: fallback }
}
const locArr = (v: unknown): Loc[] =>
  arr(v)
    .map((x) => loc(x))
    .filter((l) => (l.en ?? '').length > 0 || (l.vi ?? '').length > 0)

const throwIfTruncated = (finishReason: string | undefined): void => {
  if (finishReason === 'max_tokens')
    throw AppError.validation([
      {
        path: 'plan',
        message: 'Sinh kế hoạch bị CẮT vì hết token — thu hẹp phạm vi.',
        code: 'truncated',
      },
    ])
}

// ── KHOÁ ─────────────────────────────────────────────────────────────────────

function sanitizeCoursePlan(
  o: Record<string, unknown>,
  courseSlug: string,
  shellUnits: readonly string[],
): CoursePlanDoc {
  const allow = new Set(shellUnits)
  const units = arr(o.units)
    .map((u, i) => {
      const uo = rec(u)
      const slug = str(uo.slug)
      if (!slug || !allow.has(slug)) return undefined // chỉ unit có thật, không bịa
      return {
        slug,
        title: loc(uo.title, slug),
        focus: loc(uo.focus),
        objectives: strArr(uo.objectives),
        order: typeof uo.order === 'number' ? uo.order : i,
      }
    })
    .filter((u): u is NonNullable<typeof u> => u !== undefined)
    .sort((a, b) => a.order - b.order)

  // Chỉ giữ loc có nội dung (rỗng → bỏ field, để quality cảnh báo thay vì lưu {en:''}).
  const optLoc = (v: unknown): Loc | undefined => {
    const l = loc(v)
    return (l.en ?? '').trim() || (l.vi ?? '').trim() ? l : undefined
  }
  const bigIdea = optLoc(o.bigIdea)
  const transferGoal = optLoc(o.transferGoal)

  return {
    courseSlug,
    title: loc(o.title, courseSlug),
    ...(bigIdea ? { bigIdea } : {}),
    ...(transferGoal ? { transferGoal } : {}),
    goals: locArr(o.goals),
    outcomes: locArr(o.outcomes),
    approach: loc(o.approach),
    sequenceRationale: loc(o.sequenceRationale),
    assessmentStrategy: loc(o.assessmentStrategy),
    ...(o.audience ? { audience: loc(o.audience) } : {}),
    units,
  }
}

export interface PlanResult {
  /**
   * Kèm `invalidated`: những cấp DƯỚI vừa bị gỡ dấu duyệt vì bản này được sinh lại.
   *
   * Phải đi ra tới người soạn. Họ sinh lại kế hoạch khoá và không nhìn thấy rằng ba chương cùng
   * năm bài vừa mất con dấu duyệt thì họ tưởng mọi thứ còn nguyên — rồi phát hiện ở chỗ khác, muộn hơn.
   */
  readonly plan: StoredPlan & { readonly invalidated?: readonly string[] }
  readonly quality: ReturnType<typeof coursePlanQuality>
}

export async function generateCoursePlan(input: {
  courseSlug: string
  language: string
  userId: string
  aiKey?: string
  /** Cho phép HỦY job nền — luồn xuống LLM call. */
  signal?: AbortSignal
}): Promise<PlanResult> {
  const course = await getCourse(input.courseSlug)
  if (!course) throw AppError.notFound('Không có khoá này.')

  const shellUnits = course.plan.units.map((u) => u.slug)
  const shell = JSON.stringify({
    slug: course.plan.slug,
    title: course.plan.title,
    objectives: course.plan.objectives,
    units: course.plan.units.map((u) => ({
      slug: u.slug,
      title: u.title,
      lessons: u.lessons.map((l) => ({ slug: l.slug, title: l.title, teaches: l.teaches })),
    })),
  })

  const res = await getAi(input.aiKey).generateText({
    ...(input.signal ? { signal: input.signal } : {}),
    system: await renderPrompt('authoring.plan.course', { language: input.language, shell }),
    messages: [{ role: 'user', content: `Course=${input.courseSlug}` }],
    model: modelFor('content'),
    maxTokens: 4000,
  })
  throwIfTruncated(res.finishReason)

  const doc = sanitizeCoursePlan(
    parseModelJson(res.text, 'Không sinh được kế hoạch'),
    input.courseSlug,
    shellUnits,
  )
  const quality = coursePlanQuality(doc, shellUnits)
  const plan = await savePlan({
    courseSlug: input.courseSlug,
    level: 'course',
    refSlug: input.courseSlug,
    doc,
    quality,
    createdBy: input.userId,
    provenance: { aiModel: modelFor('content'), ...(await promptFingerprint('authoring.plan.course')) },
  })
  return { plan, quality }
}

// ── UNIT ─────────────────────────────────────────────────────────────────────

function sanitizeUnitPlan(
  o: Record<string, unknown>,
  courseSlug: string,
  unitSlug: string,
  shellLessons: readonly string[],
): UnitPlanDoc {
  const allow = new Set(shellLessons)
  const lessons = arr(o.lessons)
    .map((l, i) => {
      const lo = rec(l)
      const slug = str(lo.slug)
      if (!slug || !allow.has(slug)) return undefined
      return {
        slug,
        title: loc(lo.title, slug),
        role: loc(lo.role),
        teaches: strArr(lo.teaches),
        ...(typeof lo.durationMin === 'number' && lo.durationMin > 0
          ? { durationMin: Math.round(lo.durationMin) }
          : {}),
        order: typeof lo.order === 'number' ? lo.order : i,
      }
    })
    .filter((l): l is NonNullable<typeof l> => l !== undefined)
    .sort((a, b) => a.order - b.order)

  // Chỉ giữ loc có nội dung (rỗng → bỏ field, để quality cảnh báo thay vì lưu {en:''}).
  const optLoc = (v: unknown): Loc | undefined => {
    const l = loc(v)
    return (l.en ?? '').trim() || (l.vi ?? '').trim() ? l : undefined
  }
  const bigIdea = optLoc(o.bigIdea)
  const essentialQuestion = optLoc(o.essentialQuestion)
  const transferGoal = optLoc(o.transferGoal)

  return {
    unitSlug,
    courseSlug,
    title: loc(o.title, unitSlug),
    ...(bigIdea ? { bigIdea } : {}),
    ...(essentialQuestion ? { essentialQuestion } : {}),
    arc: loc(o.arc),
    objectives: locArr(o.objectives),
    ...(transferGoal ? { transferGoal } : {}),
    lessons,
    assessmentStrategy: loc(o.assessmentStrategy),
    successCriteria: locArr(o.successCriteria),
    // prerequisites: KHÔNG lấy từ LLM — derive từ graph (plan-insights).
  }
}

export async function generateUnitPlan(input: {
  courseSlug: string
  unitSlug: string
  language: string
  userId: string
  aiKey?: string
  /** Cho phép HỦY job nền — luồn xuống LLM call. */
  signal?: AbortSignal
}): Promise<{
  plan: StoredPlan & { readonly invalidated?: readonly string[] }
  quality: ReturnType<typeof unitPlanQuality>
}> {
  // CỔNG: kế hoạch KHOÁ phải DUYỆT trước.
  if (!(await isApproved(input.courseSlug, 'course', input.courseSlug)))
    throw AppError.validation([
      {
        path: 'course',
        message: 'Chưa DUYỆT kế hoạch KHOÁ — duyệt nó trước khi sinh kế hoạch unit (để có context tổng thể).',
        code: 'parent_not_approved',
      },
    ])

  const course = await getCourse(input.courseSlug)
  if (!course) throw AppError.notFound('Không có khoá này.')
  const unit = course.plan.units.find((u) => u.slug === input.unitSlug)
  if (!unit) throw AppError.notFound('Không có unit này trong khoá.')

  const coursePlan = await getPlan(input.courseSlug, 'course', input.courseSlug)
  const courseContext = JSON.stringify(coursePlan?.doc ?? {})
  const shellLessons = unit.lessons.map((l) => l.slug)
  const unitJson = JSON.stringify({
    slug: unit.slug,
    title: unit.title,
    lessons: unit.lessons.map((l) => ({ slug: l.slug, title: l.title, teaches: l.teaches })),
  })

  const res = await getAi(input.aiKey).generateText({
    ...(input.signal ? { signal: input.signal } : {}),
    system: await renderPrompt('authoring.plan.unit', {
      language: input.language,
      courseContext,
      unit: unitJson,
    }),
    messages: [{ role: 'user', content: `Unit=${input.unitSlug}` }],
    model: modelFor('content'),
    maxTokens: 4000,
  })
  throwIfTruncated(res.finishReason)

  const doc = sanitizeUnitPlan(
    parseModelJson(res.text, 'Không sinh được kế hoạch'),
    input.courseSlug,
    input.unitSlug,
    shellLessons,
  )
  const quality = unitPlanQuality(doc, shellLessons)
  const plan = await savePlan({
    courseSlug: input.courseSlug,
    level: 'unit',
    refSlug: input.unitSlug,
    doc,
    quality,
    createdBy: input.userId,
    provenance: { aiModel: modelFor('content'), ...(await promptFingerprint('authoring.plan.unit')) },
  })
  return { plan, quality }
}

export { sanitizeCoursePlan, sanitizeUnitPlan }

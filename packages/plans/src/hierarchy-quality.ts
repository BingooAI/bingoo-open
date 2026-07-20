/**
 * QUALITY cho kế hoạch KHOÁ & UNIT — thuần, không I/O. Đây là cổng: `approvable=false` thì người
 * KHÔNG nên duyệt (và cấp dưới không nên sinh). KHÔNG ép văn phong, chỉ kiểm những gì thiếu là hỏng:
 * phủ đủ unit/bài, có mục tiêu/đầu ra/đánh giá, không bỏ sót.
 */

import type { Slug } from '@bingoo.ai/knowledge-engine'
import type { CoursePlanDoc, UnitPlanDoc } from './hierarchy'

export type HierIssueCode =
  | 'NO_GOALS'
  | 'NO_OUTCOMES'
  | 'NO_APPROACH'
  | 'NO_ASSESSMENT_STRATEGY'
  | 'UNIT_NOT_COVERED'
  | 'EXTRA_UNIT'
  | 'UNIT_NO_FOCUS'
  | 'NO_ARC'
  | 'NO_OBJECTIVES'
  | 'NO_BIG_IDEA'
  | 'NO_TRANSFER_GOAL'
  | 'LESSON_NOT_COVERED'
  | 'EXTRA_LESSON'
  | 'LESSON_NO_ROLE'
  | 'NO_SUCCESS_CRITERIA'

export interface HierIssue {
  readonly code: HierIssueCode
  readonly severity: 'error' | 'warning'
  readonly message: string
  readonly refs?: readonly string[]
}

export interface HierQuality {
  readonly issues: readonly HierIssue[]
  readonly score: number
  readonly approvable: boolean
}

const has = (t?: { readonly [k: string]: string }): boolean =>
  !!t && Object.values(t).some((v) => v.trim().length > 0)

function finalize(issues: HierIssue[]): HierQuality {
  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.filter((i) => i.severity === 'warning').length
  const score = Math.max(0, 100 - 15 * errors - 5 * warnings)
  return { issues, score, approvable: errors === 0 && score >= 80 }
}

/**
 * Kế hoạch KHOÁ phải PHỦ ĐÚNG các unit của vỏ khoá (`shellUnitSlugs`) — không thiếu, không thừa
 * (thừa = LLM bịa unit không có trong khoá). Và phải có mục tiêu/đầu ra/tiếp cận/đánh giá.
 */
export function coursePlanQuality(doc: CoursePlanDoc, shellUnitSlugs: readonly Slug[]): HierQuality {
  const issues: HierIssue[] = []
  const err = (code: HierIssueCode, message: string, refs?: string[]): void => {
    issues.push({ code, severity: 'error', message, ...(refs ? { refs } : {}) })
  }
  const warn = (code: HierIssueCode, message: string, refs?: string[]): void => {
    issues.push({ code, severity: 'warning', message, ...(refs ? { refs } : {}) })
  }

  if (doc.goals.length === 0) err('NO_GOALS', 'Kế hoạch khoá thiếu MỤC TIÊU tổng thể.')
  if (doc.outcomes.length === 0) err('NO_OUTCOMES', 'Kế hoạch khoá thiếu CHUẨN ĐẦU RA.')
  if (!has(doc.bigIdea)) warn('NO_BIG_IDEA', 'Chưa nêu BIG IDEA (ý hiểu bền vững xuyên khoá).')
  if (!has(doc.transferGoal))
    warn('NO_TRANSFER_GOAL', 'Chưa nêu TRANSFER GOAL (dùng được vào tình huống mới).')
  if (!has(doc.approach)) warn('NO_APPROACH', 'Chưa nêu TIẾP CẬN sư phạm.')
  if (!has(doc.assessmentStrategy)) warn('NO_ASSESSMENT_STRATEGY', 'Chưa nêu CHIẾN LƯỢC ĐÁNH GIÁ khoá.')

  const planned = new Set(doc.units.map((u) => u.slug))
  const shell = new Set(shellUnitSlugs)
  for (const u of shellUnitSlugs)
    if (!planned.has(u)) err('UNIT_NOT_COVERED', `Unit "${u}" của khoá chưa được kế hoạch nhắc tới.`, [u])
  for (const u of doc.units) {
    if (!shell.has(u.slug))
      err('EXTRA_UNIT', `Kế hoạch có unit "${u.slug}" không có trong khoá (bịa?).`, [u.slug])
    if (!has(u.focus)) warn('UNIT_NO_FOCUS', `Unit "${u.slug}" chưa nêu trọng tâm.`, [u.slug])
  }
  return finalize(issues)
}

/**
 * Kế hoạch UNIT phải PHỦ ĐÚNG các bài của unit (`shellLessonSlugs`), và có mạch/mục tiêu/đánh giá/
 * tiêu chí đạt. Cùng luật: không thiếu bài, không bịa bài.
 */
export function unitPlanQuality(doc: UnitPlanDoc, shellLessonSlugs: readonly Slug[]): HierQuality {
  const issues: HierIssue[] = []
  const err = (code: HierIssueCode, message: string, refs?: string[]): void => {
    issues.push({ code, severity: 'error', message, ...(refs ? { refs } : {}) })
  }
  const warn = (code: HierIssueCode, message: string, refs?: string[]): void => {
    issues.push({ code, severity: 'warning', message, ...(refs ? { refs } : {}) })
  }

  if (!has(doc.arc)) err('NO_ARC', 'Kế hoạch unit thiếu MẠCH HỌC (các bài xây lên nhau thế nào).')
  if (doc.objectives.length === 0) err('NO_OBJECTIVES', 'Kế hoạch unit thiếu MỤC TIÊU.')
  if (!has(doc.bigIdea)) warn('NO_BIG_IDEA', 'Chưa nêu BIG IDEA (ý hiểu bền vững của unit).')
  if (!has(doc.transferGoal))
    warn('NO_TRANSFER_GOAL', 'Chưa nêu TRANSFER GOAL (dùng được vào tình huống mới).')
  if (!has(doc.assessmentStrategy)) warn('NO_ASSESSMENT_STRATEGY', 'Chưa nêu chiến lược đánh giá unit.')
  if (doc.successCriteria.length === 0) warn('NO_SUCCESS_CRITERIA', 'Chưa nêu tiêu chí đạt unit.')

  const planned = new Set(doc.lessons.map((l) => l.slug))
  const shell = new Set(shellLessonSlugs)
  for (const l of shellLessonSlugs)
    if (!planned.has(l)) err('LESSON_NOT_COVERED', `Bài "${l}" của unit chưa được kế hoạch nhắc tới.`, [l])
  for (const l of doc.lessons) {
    if (!shell.has(l.slug))
      err('EXTRA_LESSON', `Kế hoạch có bài "${l.slug}" không có trong unit (bịa?).`, [l.slug])
    if (!has(l.role)) warn('LESSON_NO_ROLE', `Bài "${l.slug}" chưa nêu vai trò trong mạch unit.`, [l.slug])
  }
  return finalize(issues)
}

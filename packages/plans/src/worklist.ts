// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Duyệt kế hoạch bài thành DANH SÁCH VIỆC SINH — theo ĐÚNG thứ tự arc → step. Thuần, không I/O.
 *
 * Đây là thứ thay "lặp per-KC rời rạc" cũ (mỗi KC sinh độc lập, mất mạch) bằng "đi theo cấu trúc": mỗi
 * KC một arc, mỗi arc một chuỗi bước có thứ tự. Executor (apps/api, gọi generator/LLM) chỉ việc duyệt
 * danh sách này và dispatch theo `step.deliveryKind`. Tách phần THUẦN (thứ tự, đầy đủ) ra để test offline.
 */

import type { KcArc, LearnerState, LessonInstructionPlan, LessonStep } from './model'
import type { Slug } from '@bingoo.ai/knowledge-engine'

export interface StepWork {
  /** KC của arc chứa bước — mọi item bước này sinh đều neo vào KC này (per-KC, không ôm đồm). */
  readonly kc: Slug
  /** Thứ tự arc trong bài (0-based) — arc đã xếp theo tiên quyết. */
  readonly arcIndex: number
  /** Thứ tự bước trong arc (0-based). */
  readonly stepIndex: number
  readonly step: LessonStep
}

/**
 * Làm phẳng kcArcs → danh sách bước THEO THỨ TỰ (arc trước, trong arc theo thứ tự bước). Giữ nguyên
 * trình tự để executor sinh đúng mạch. Bài chưa dựng cấu trúc (không kcArcs) → rỗng.
 */
export function lessonStepWork(lesson: LessonInstructionPlan): StepWork[] {
  const out: StepWork[] = []
  ;(lesson.kcArcs ?? []).forEach((arc, arcIndex) => {
    arc.steps.forEach((step, stepIndex) => {
      out.push({ kc: arc.kc, arcIndex, stepIndex, step })
    })
  })
  return out
}

/**
 * Bước có SINH ITEM cho ngân hàng không (content/practice/assessment), hay chỉ trình bày/uỷ hệ khác
 * (explainer → hệ explainer; reflection → không item). Dùng để executor biết bước nào đổ vào bank.
 */
export function stepEmitsBankItems(step: LessonStep): boolean {
  return (
    step.deliveryKind === 'content' || step.deliveryKind === 'practice' || step.deliveryKind === 'assessment'
  )
}

/** Bước phục vụ trạng thái này không? VẮNG/RỖNG forStates = nhánh mặc định → phục vụ MỌI trạng thái. */
export function stepServesState(step: LessonStep, state: LearnerState): boolean {
  return !step.forStates || step.forStates.length === 0 || step.forStates.includes(state)
}

/**
 * NHÁNH cho một trạng thái người học — Decision Engine dùng để RENDER lesson hợp người đó (mỗi trạng
 * thái ra số bước / thứ tự khác nhau). Thuần: chỉ LỌC bước theo forStates, giữ nguyên thứ tự.
 */
export function stepsForState(arc: KcArc, state: LearnerState): LessonStep[] {
  return arc.steps.filter((s) => stepServesState(s, state))
}

// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Cổng tiên quyết — REQUIRED chặn, RECOMMENDED chỉ cảnh báo. SPEC §7.3. */

import type { PrerequisiteRef } from '../contracts'
import type { SkillGraph } from './build'
import { nodeMastery, type MasteryStates } from './composite'

export interface PrereqCheck {
  readonly ref: PrerequisiteRef
  readonly met: boolean
}

export interface PrereqGateResult {
  readonly locked: boolean
  readonly required: readonly PrereqCheck[]
  readonly recommended: readonly PrereqCheck[]
}

/**
 * SPEC §7.3. `met(ref)` do host cấp cho các ref không tự suy được (LESSON: isLessonDone,
 * thiếu tín hiệu → true, KHÔNG chặn cứng). REQUIRED chưa đạt → khoá; RECOMMENDED không bao
 * giờ khoá.
 */
export function prereqGate(
  prereqs: readonly PrerequisiteRef[],
  met: (ref: PrerequisiteRef) => boolean,
): PrereqGateResult {
  if (prereqs.length === 0) return { locked: false, required: [], recommended: [] }

  const required: PrereqCheck[] = []
  const recommended: PrereqCheck[] = []
  for (const ref of prereqs) {
    const check: PrereqCheck = { ref, met: met(ref) }
    if (ref.mode === 'REQUIRED') required.push(check)
    else recommended.push(check)
  }
  return {
    locked: required.some((c) => !c.met),
    required,
    recommended,
  }
}

/**
 * Tiện ích: `met` cho ref COMPETENCY suy thẳng từ graph (achieved = nodeMastery ≥ threshold).
 * Ref LESSON uỷ cho `isLessonDone` của host (mặc định true khi thiếu tín hiệu).
 */
export function competencyMetFactory(
  graph: SkillGraph,
  states: MasteryStates,
  threshold: number,
  isLessonDone: (lessonId: string) => boolean = () => true,
): (ref: PrerequisiteRef) => boolean {
  return (ref) => {
    if (ref.requiredType === 'LESSON') return isLessonDone(ref.requiredId)
    if (!graph.has(ref.requiredId)) return true // không có node → không chặn
    return nodeMastery(graph, states, ref.requiredId, threshold).achieved
  }
}

/** Biên dịch Instruction Plan → dữ liệu host/engine dùng (lessonTeaches, blueprint certify). */

import type { Slug } from '@bingoo.ai/knowledge-engine'
import type { AssessmentPlan, CoursePlan } from './model'

/** lessonSlug → khái niệm bài dạy (cho lessonTeaches / rollup). */
export function courseLessonTeaches(course: CoursePlan): Map<Slug, Slug[]> {
  const out = new Map<Slug, Slug[]>()
  for (const u of course.units) {
    for (const l of u.lessons) {
      const concepts = new Set<Slug>(l.teaches)
      for (const kp of l.knowledgePoints) for (const kc of kp.targets) concepts.add(kc)
      out.set(l.slug, [...concepts])
    }
  }
  return out
}

/** Gom mọi AssessmentPlan của khoá. */
export function collectAssessments(course: CoursePlan): AssessmentPlan[] {
  const out: AssessmentPlan[] = []
  for (const u of course.units) {
    for (const l of u.lessons) {
      if (l.assessment) out.push(l.assessment)
    }
  }
  return out
}

/** Objective một bài đo nhắm (đầu vào certifyFramework của engine). */
export function assessmentObjectives(a: AssessmentPlan): readonly Slug[] {
  return a.objectives
}

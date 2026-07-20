/** teacherView — mặt đọc của người dạy. BỔ SUNG §3.4. */

import type { Slug } from '../contracts'
import type { EnginePolicy } from '../policy'
import type { SkillGraph } from '../graph/build'
import { frontierComposite, type FrontierNode } from '../graph/frontier'
import { gapsTo } from '../graph/path'
import type { SkillMastery } from '../mastery/observe'
import { classRollup, type Distribution } from './distribution'
import { coverageReport, type CoverageReport } from './coverage'

export interface TeacherCoverageInput {
  readonly objectives: readonly Slug[]
  readonly attached: ReadonlySet<Slug>
  readonly taughtConcepts: ReadonlySet<Slug>
}

export interface TeacherViewInput {
  readonly graph: SkillGraph
  readonly statesByLearner: ReadonlyMap<string, ReadonlyMap<Slug, SkillMastery>>
  /** Năng lực để tổng hợp phân phối lớp. */
  readonly competencies: readonly Slug[]
  /** Mục tiêu từng học viên để tính gaps (tuỳ chọn). */
  readonly goals?: ReadonlyMap<string, Slug>
  readonly coverage?: TeacherCoverageInput
}

export interface LearnerDiagnostic {
  readonly frontier: FrontierNode[]
  readonly gaps: Slug[]
}

export interface TeacherView {
  readonly perLearner: Map<string, LearnerDiagnostic>
  readonly classRollup: Map<Slug, Distribution>
  readonly coverage?: CoverageReport
}

/** Chẩn đoán từng học viên (frontier + gaps) + phân phối lớp + lỗ phủ chuẩn. */
export function teacherView(input: TeacherViewInput, policy: EnginePolicy): TeacherView {
  const threshold = policy.mastery.threshold
  const perLearner = new Map<string, LearnerDiagnostic>()
  for (const [learnerId, states] of input.statesByLearner) {
    const goal = input.goals?.get(learnerId)
    perLearner.set(learnerId, {
      frontier: frontierComposite(input.graph, states, threshold),
      gaps: goal !== undefined ? gapsTo(input.graph, states, goal, threshold) : [],
    })
  }

  const view: TeacherView = {
    perLearner,
    classRollup: classRollup(input.graph, input.statesByLearner, input.competencies, policy),
    ...(input.coverage
      ? {
          coverage: coverageReport(
            input.graph,
            input.coverage.objectives,
            input.coverage.attached,
            input.coverage.taughtConcepts,
          ),
        }
      : {}),
  }
  return view
}

// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** contentPlan — Instruction Plan + persona + snapshot engine → GenerationSpec (per-persona). */

import type { Slug } from '@bingoo.ai/knowledge-engine'
import type { LessonInstructionPlan } from '@bingoo.ai/plans'
import type {
  DifficultyBand,
  EngineSnapshot,
  GenerationSpec,
  LearnerPersona,
  LearningLevel,
  TeacherPersona,
} from './model'

interface LevelConfig {
  readonly band: DifficultyBand
  readonly bandRange: readonly DifficultyBand[]
  readonly hintOpenLevel: number
  readonly stage: 'concrete' | 'pictorial' | 'abstract'
  readonly pace: 'slow' | 'standard' | 'fast'
}

// Cùng chuẩn, khác giàn giáo/nhịp (§6). Chuẩn/cut ở Instruction Plan — KHÔNG đụng ở đây.
const LEVEL: Record<LearningLevel, LevelConfig> = {
  L1: {
    band: 'easy',
    bandRange: ['easy', 'core'],
    hintOpenLevel: 3,
    stage: 'concrete',
    pace: 'slow',
  },
  L2: { band: 'core', bandRange: ['core'], hintOpenLevel: 0, stage: 'pictorial', pace: 'standard' },
  L3: {
    band: 'stretch',
    bandRange: ['core', 'stretch'],
    hintOpenLevel: 0,
    stage: 'abstract',
    pace: 'fast',
  },
}

/** Khái niệm đích của bài = teaches ∪ KP.targets. */
function lessonKcs(lesson: LessonInstructionPlan): Slug[] {
  const set = new Set<Slug>(lesson.teaches)
  for (const kp of lesson.knowledgePoints) for (const kc of kp.targets) set.add(kc)
  return [...set]
}

export function contentPlan(
  lesson: LessonInstructionPlan,
  learner: LearnerPersona,
  teacher?: TeacherPersona,
  snapshot?: EngineSnapshot,
): GenerationSpec {
  const cfg = LEVEL[learner.level]
  const storyTheme = learner.interests?.[0]
  const variant = teacher?.variants?.[0] ?? 'worksheet'

  return {
    targetKcs: lessonKcs(lesson),
    variant,
    ...(storyTheme !== undefined ? { storyTheme } : {}),
    difficultyBand: cfg.band,
    bandRange: [...cfg.bandRange],
    scaffolding: { hintOpenLevel: cfg.hintOpenLevel, representationStage: cfg.stage },
    reviewInserts: snapshot?.fading ?? [],
    language: learner.language,
    ...(learner.accessibility !== undefined ? { accessibility: learner.accessibility } : {}),
    pace: cfg.pace,
  }
}

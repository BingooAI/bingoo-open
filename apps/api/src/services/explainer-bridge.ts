// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * BRIDGE: bước explainer trong kế hoạch bài → `LessonBrief` (brief/v1) cho hệ explainer.
 *
 * Bước kiểu `explainer` KHÔNG tự vẽ cảnh — nó UỶ cho pipeline explainer (OUTLINE→WRITE→CRITIC→REGEN).
 * Chất lượng đầu ra ∝ chất lượng brief, và kế hoạch bài ĐÃ có sẵn nguyên liệu: KC, brief/mustCover của
 * bước, hiểu-sai (KP.misconceptions), tiên quyết, facets. Hàm này chỉ MAP — thuần, không I/O — nên test
 * được offline (đối chiếu bằng `parseBrief`).
 *
 * Điểm nối HỒ CHUNG: `objectives[].skills = [kcSlug]` → explainer kéo câu ĐÃ DUYỆT từ bank thay vì tự
 * viết (feed, không sinh lại). `facts` (đã kiểm) chống bịa số. `durationMin` → `sceneCount` (~32s/cảnh).
 */

import type { LessonBrief } from '@bingoo.ai/explainer'
import type { KnowledgePoint, LessonStep, LocalizedText } from '@bingoo.ai/plans'

export type AudienceStage = 'preschool' | 'primary' | 'middle' | 'high' | 'adult'

export interface ExplainerBridgeInput {
  readonly step: LessonStep
  /** KC bước phục vụ (arc chứa bước). */
  readonly kcSlug: string
  readonly kcTitle: string
  readonly language: string
  readonly subject: string
  readonly audience: { readonly stage: AudienceStage; readonly grade?: string }
  /** Bậc biểu diễn (concrete→pictorial→abstract) — lái imagePolicy. */
  readonly representationStage?: 'concrete' | 'pictorial' | 'abstract'
  readonly band?: 'easy' | 'core' | 'stretch'
  /** KP của arc — nguồn hiểu-sai + tiêu chí đạt (thành objective statement). */
  readonly knowledgePoints?: readonly KnowledgePoint[]
  /** Tiên quyết → priorKnowledge (giả định đã biết). */
  readonly prerequisites?: readonly string[]
  /** Dữ kiện ĐÃ KIỂM (số/công thức) — explainer narrate verbatim, không tính lại → chống bịa. */
  readonly facts?: readonly { id: string; statement: string; value?: string | number }[]
  /** Câu chuẩn đầu ra cho objective (nếu có); thiếu thì dùng kcTitle. */
  readonly successCriteria?: readonly string[]
}

const SEC_PER_SCENE = 32 // khớp arc.ts của explainer

const loc = (t: LocalizedText | undefined): string =>
  t ? (t['en'] ?? t['vi'] ?? Object.values(t)[0] ?? '') : ''

/** durationMin → sceneCount (3–12) theo ~32s/cảnh. */
function sceneCountFor(durationMin: number): number {
  const raw = Math.round((durationMin * 60) / SEC_PER_SCENE)
  return Math.min(12, Math.max(3, raw))
}

function imagePolicyFor(stage?: string): 'none' | 'sparing' | 'rich' {
  // Concrete (mầm non/mới) cần nhiều ảnh thật; trừu tượng thì tiết chế.
  if (stage === 'concrete') return 'rich'
  return 'sparing'
}

function difficultyFor(band?: string): 'intro' | 'practice' | 'challenge' {
  if (band === 'easy') return 'intro'
  if (band === 'stretch') return 'challenge'
  return 'practice'
}

/**
 * MAP thuần → LessonBrief. LUÔN trả brief hợp lệ (parseBrief nhận) cho một bước explainer dạy một KC.
 * Không ném lỗi: caller sẽ parseBrief để chốt, nhưng hàm này cố dựng đúng ngay từ đầu.
 */
export function lessonStepToBrief(input: ExplainerBridgeInput): LessonBrief {
  const { step } = input

  // subject.notes = ý đồ CỤ THỂ của bước (chống sinh chung chung).
  const notes = [loc(step.brief), ...(step.mustCover ?? []).map(loc)].filter(Boolean).join(' · ')

  const misconceptions = (input.knowledgePoints ?? [])
    .flatMap((kp) => kp.misconceptions.map((m) => loc(m.wrong)))
    .filter(Boolean)

  const statement = input.successCriteria?.[0]?.trim() || input.kcTitle

  const brief: LessonBrief = {
    version: 'brief/v1',
    topic: input.kcTitle,
    locales: [input.language],
    audience: {
      stage: input.audience.stage,
      ...(input.audience.grade ? { grade: input.audience.grade } : {}),
    },
    subject: {
      domain: input.subject,
      ...(notes ? { notes } : {}),
    },
    objectives: [
      {
        id: input.kcSlug,
        statement,
        assess: true,
        // ĐIỂM NỐI BANK: explainer kéo câu đã duyệt của KC này thay vì tự viết.
        skills: [input.kcSlug],
      },
    ],
    source: { materials: [], grounding: 'open' },
    facts: (input.facts ?? []).map((f) => ({
      id: f.id,
      statement: f.statement,
      ...(f.value !== undefined ? { value: f.value } : {}),
    })),
    assets: [],
    misconceptions: [...new Set(misconceptions)],
    priorKnowledge: [...(input.prerequisites ?? [])],
    assessment: { difficulty: difficultyFor(input.band) },
    constraints: {
      sceneCount: sceneCountFor(step.durationMin),
      imagePolicy: imagePolicyFor(input.representationStage),
    },
  }
  return brief
}

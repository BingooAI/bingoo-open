// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Bộ chấm theo primitiveKind — dispatcher. auto-key (quiz) + coverage (draw) + manip (67 kit thao tác).
 * rubric/code/peer/observation KHÔNG chấm tự động từ payload → cần verdict NGOÀI (rater/LLM/sandbox cấp).
 *
 * DISPATCH THEO graderKind (dữ liệu registry), KHÔNG theo tên kind cứng → primitive mới chỉ cần đăng ký
 * đúng graderKind là chấm được, không đụng dispatcher.
 */

import { manipGrader, primitiveMeta, quizGrader, type Grader } from '@bingoo.ai/authored-item'
import {
  coloringScore,
  scoreTracedStroke,
  type ColoringPicture,
  type DrawPoint,
  type Grade,
  type TracingGlyph,
} from '@bingoo.ai/core'

/** coloringPicture: tỉ lệ tô đúng. response = { areaId: color }. */
const coloringGrader: Grader = (payload, response): Grade => {
  const fills = response && typeof response === 'object' ? (response as Record<string, string>) : {}
  const score = coloringScore(payload as ColoringPicture, fills)
  return { correct: score >= 0.999, score }
}

/** tracingGlyph: coverage trung bình các nét. response = nét đã vẽ [{points}] khớp guide. */
const tracingGrader: Grader = (payload, response): Grade => {
  const guide = (payload as TracingGlyph | undefined)?.strokes ?? []
  const drawn = Array.isArray(response) ? (response as { points?: DrawPoint[] }[]) : []
  if (guide.length === 0) return { correct: false, score: 0 }
  let sum = 0
  guide.forEach((g, i) => {
    const gp = (g as { points?: DrawPoint[] }).points ?? []
    const dp = drawn[i]?.points ?? []
    sum += gp.length && dp.length ? scoreTracedStroke([...gp], [...dp]).coverage : 0
  })
  const score = sum / guide.length
  return { correct: score >= 0.85, score }
}

/** Grader tự động cho primitiveKind; null nếu cần verdict ngoài (rubric/code/peer/observation). */
export function graderFor(primitiveKind: string): Grader | null {
  const meta = primitiveMeta(primitiveKind)
  if (!meta) return null
  switch (meta.graderKind) {
    case 'auto-key':
      return quizGrader
    case 'manip':
      // Mọi kit (63 và còn tăng) — manipGrader tự đọc kind trong payload → checkAnswer, không case riêng.
      return manipGrader
    case 'coverage':
      // Chỉ 2 draw primitive, chấm khác nhau nên tách theo kind (payload schema khác hẳn).
      return primitiveKind === 'coloringPicture' ? coloringGrader : tracingGrader
    default:
      return null // rubric/code/peer/observation → verdict ngoài
  }
}

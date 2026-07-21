// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { quizLabelsFrom, type QuizTranslator } from '@bingoo.ai/explainer-web'
import type { QuizLabels } from '@bingoo.ai/ui-web'

/**
 * Copy for quiz beats inside a lesson, built from the `quiz` namespace.
 *
 * The player and the component library are both i18n-free on purpose: they take every string as
 * data, so neither has to know which languages exist. Translation is the host's job, and this is
 * where the host does it. Same shape as `buildExperienceLabels`.
 */
export function buildQuizLabels(t: QuizTranslator): QuizLabels {
  return quizLabelsFrom(t)
}

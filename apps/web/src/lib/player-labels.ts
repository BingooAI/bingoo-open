// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { playerLabelsFrom, type PlayerLabels, type PlayerTranslator } from '@bingoo.ai/explainer-web'

/**
 * Copy for the lesson player chrome and its gates, built from the `player` namespace.
 *
 * Same shape as `buildQuizLabels` and `buildExperienceLabels`: the packages take strings as
 * data and know nothing about which languages exist, and the host does the translating.
 */
export function buildPlayerLabels(t: PlayerTranslator): PlayerLabels {
  return playerLabelsFrom(t)
}

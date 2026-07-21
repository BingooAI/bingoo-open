// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Fallback copy for the embedded quiz UI.
 *
 * `QuizShell` in `@bingoo.ai/ui-web` takes every string as data, which is the right shape — a
 * component library that renders one language is a component library one country can use. This
 * file is only what the player falls back to when a host passes nothing.
 *
 * The fallback is **English**, and that is the point. These labels used to be Vietnamese, so an
 * English-speaking learner met "Kiểm tra" in the middle of a lesson. A fallback in the
 * maintainers' own language is invisible to the maintainers and visible to everyone else.
 *
 * Hosts pass their own via `quizLabelsFrom`.
 */
import type { QuizLabels } from '@bingoo.ai/ui-web'

/** Used when a host passes no labels. English, so a missing translation reads as untranslated. */
export const DEFAULT_QUIZ_LABELS: QuizLabels = {
  questionOf: (i, t) => `Question ${i + 1}/${t}`,
  check: 'Check',
  next: 'Next',
  finish: 'Finish',
  skip: 'Skip',
  undo: 'Undo',
  crosswordAcross: 'Across',
  crosswordDown: 'Down',
  showHint: 'Hint',
  correct: 'Correct',
  incorrect: 'Not quite',
  explanationTitle: 'Explanation',
  moveUp: 'Up',
  moveDown: 'Down',
  fillPlaceholder: '…',
  progressLabel: 'Progress',
  playMedia: 'Play',
  vennNeither: 'Neither',
  clockMinuteLabels: { 0: "o'clock", 30: 'half past' },
  placeValueLabels: { tens: 'Tens', ones: 'Ones' },
  result: {
    passTitle: 'Done!',
    failTitle: 'Try again',
    passSubtitle: 'Well done!',
    failSubtitle: 'Have another look, then try again.',
    accuracyLabel: 'Accuracy',
    correctLabel: 'Correct answers',
    retry: 'Retry',
    continueLabel: 'Continue',
  },
}

/**
 * A translator bound to a namespace — `useTranslations('quiz')` from next-intl, or anything
 * else of the same shape. The player does not depend on next-intl; it depends on being handed
 * a function, which is what keeps this package usable outside this repository.
 */
export type QuizTranslator = (key: string) => string

/**
 * Build a label pack from a translator.
 *
 * Keys are looked up eagerly rather than per render, so a missing message surfaces when the
 * host wires this up rather than on the one question type that happens to use it.
 */
export function quizLabelsFrom(t: QuizTranslator): QuizLabels {
  return {
    questionOf: (i, n) => `${t('questionOf')} ${i + 1}/${n}`,
    check: t('check'),
    next: t('next'),
    finish: t('finish'),
    skip: t('skip'),
    undo: t('undo'),
    crosswordAcross: t('crosswordAcross'),
    crosswordDown: t('crosswordDown'),
    showHint: t('showHint'),
    correct: t('correct'),
    incorrect: t('incorrect'),
    explanationTitle: t('explanationTitle'),
    moveUp: t('moveUp'),
    moveDown: t('moveDown'),
    fillPlaceholder: t('fillPlaceholder'),
    progressLabel: t('progressLabel'),
    playMedia: t('playMedia'),
    vennNeither: t('vennNeither'),
    clockMinuteLabels: { 0: t('clockOClock'), 30: t('clockHalfPast') },
    placeValueLabels: { tens: t('placeValueTens'), ones: t('placeValueOnes') },
    result: {
      passTitle: t('resultPassTitle'),
      failTitle: t('resultFailTitle'),
      passSubtitle: t('resultPassSubtitle'),
      failSubtitle: t('resultFailSubtitle'),
      accuracyLabel: t('resultAccuracy'),
      correctLabel: t('resultCorrect'),
      retry: t('resultRetry'),
      continueLabel: t('resultContinue'),
    },
  }
}

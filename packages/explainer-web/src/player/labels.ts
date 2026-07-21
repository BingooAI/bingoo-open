// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Copy for the player chrome and the interactive gates.
 *
 * Everything a learner reads is data, not source. A player that renders one language is a
 * player one country can use, and the strings here — "Pause", "Correct!", "Not quite" — are
 * exactly the ones a child meets mid-lesson.
 *
 * The default is English, deliberately. These used to be Vietnamese, so a learner running the
 * platform in English hit "Chưa đúng" the first time they answered wrong. A fallback in the
 * maintainers' own language is invisible to the maintainers and visible to everyone else; an
 * English one at least reads as *untranslated* rather than as somebody else's language.
 */

export interface PlayerLabels {
  /** Transport controls, read by screen readers as well as shown as tooltips. */
  play: string
  pause: string
  restart: string
  timeline: string
  captionsOn: string
  captionsOff: string
  audio: string
  settings: string
  settingsHint: string
  speed: string
  /** Badges that introduce a gate. */
  tryIt: string
  question: string
  interactiveQuestion: string
  putInOrder: string
  /** Short badge shown on the gate card. */
  interactive: string
  order: string
  /** Feedback after an answer. A gate may override these per beat via `gate.feedback`. */
  correct: string
  correctPlace: string
  correctOrder: string
  wrong: string
  wrongRetry: string
  wrongOrder: string
  /** Shown when a gate declares an activity with nothing in it. */
  emptyActivity: string
}

export const DEFAULT_PLAYER_LABELS: PlayerLabels = {
  play: 'Play',
  pause: 'Pause',
  restart: 'Start over',
  timeline: 'Timeline',
  captionsOn: 'Show captions',
  captionsOff: 'Hide captions',
  audio: 'Sound',
  settings: 'Settings',
  settingsHint: 'Speed · size · language',
  speed: 'Speed',
  tryIt: 'Try it',
  question: 'Question',
  interactiveQuestion: 'Interactive question',
  putInOrder: 'Put in order',
  interactive: 'Interactive',
  order: 'Order',
  correct: 'Correct!',
  correctPlace: 'Right spot!',
  correctOrder: 'Right order!',
  wrong: 'Not quite — try again.',
  wrongRetry: 'Not quite, try again.',
  wrongOrder: 'Not in the right order.',
  emptyActivity: 'This activity is empty.',
}

/** A translator bound to a namespace — `useTranslations('player')`, or any function of that shape. */
export type PlayerTranslator = (key: string) => string

/**
 * Build a label pack from a translator.
 *
 * Keys are read eagerly, so a missing message surfaces when a host wires this up rather than on
 * the one gate type that happens to use it.
 */
export function playerLabelsFrom(t: PlayerTranslator): PlayerLabels {
  return {
    play: t('play'),
    pause: t('pause'),
    restart: t('restart'),
    timeline: t('timeline'),
    captionsOn: t('captionsOn'),
    captionsOff: t('captionsOff'),
    audio: t('audio'),
    settings: t('settings'),
    settingsHint: t('settingsHint'),
    speed: t('speed'),
    tryIt: t('tryIt'),
    question: t('question'),
    interactiveQuestion: t('interactiveQuestion'),
    putInOrder: t('putInOrder'),
    interactive: t('interactive'),
    order: t('order'),
    correct: t('correct'),
    correctPlace: t('correctPlace'),
    correctOrder: t('correctOrder'),
    wrong: t('wrong'),
    wrongRetry: t('wrongRetry'),
    wrongOrder: t('wrongOrder'),
    emptyActivity: t('emptyActivity'),
  }
}

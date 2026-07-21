<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/ui-web

React DOM components for building lessons: form primitives, overlays, charts, and about 70 interactive
answer tools — number lines, clock faces, ten frames, Venn boards, coordinate grids, protractors.

Reach for it when you are building a teaching surface and do not want to write a drag-and-drop
categorise board or a symmetry grid from scratch. `QuizShell` is the one component that does the most
work: give it questions from `@bingoo.ai/core` and it picks the right input for each question type,
grades on check, reveals hints and explanations, and ends on a result screen.

Every component takes its display text as props. The package contains no strings to translate and no
locale files, so it drops into an app using next-intl, react-i18next, or nothing at all.

## Setup

Not published to npm. Inside the monorepo, depend on it as `"@bingoo.ai/ui-web": "workspace:*"`. It
exports TypeScript source rather than a build, so your bundler must transpile it.

Styling comes from `@bingoo.ai/tokens`, and the components are Tailwind-classed. In your global CSS:

```css
@import 'tailwindcss';
@import '@bingoo.ai/tokens/css';
@source '../../../../packages/ui-web/src/**/*.{ts,tsx}';
```

Without the `@source` line Tailwind never sees the package's class names and the components render unstyled.

## Example

```tsx
import type { QuizQuestion } from '@bingoo.ai/core'
import { PackScope, QuizShell, type QuizLabels } from '@bingoo.ai/ui-web'

const questions: QuizQuestion[] = [
  {
    id: 'q1',
    type: 'single',
    prompt: 'Which one is a mammal?',
    choices: [
      { id: 'a', label: 'Whale', emoji: '🐋' },
      { id: 'b', label: 'Shark', emoji: '🦈' },
    ],
    answerId: 'a',
  },
]

const labels: QuizLabels = {
  check: 'Check',
  next: 'Next',
  finish: 'Finish',
  showHint: 'Hint',
  correct: 'Correct',
  incorrect: 'Not quite',
  result: {
    passTitle: 'Passed',
    failTitle: 'Try again',
    accuracyLabel: 'Accuracy',
    correctLabel: 'Correct',
    retry: 'Retry',
    continueLabel: 'Continue',
  },
}

export function Lesson() {
  return (
    <PackScope pack="playful" accent="teal">
      <QuizShell questions={questions} labels={labels} locale="en" lives={3} />
    </PackScope>
  )
}
```

`PackScope` stamps `data-pack` / `data-accent` on a subtree; token overrides cascade to every descendant,
so the same components re-skin from `junior` (round, bouncy) to `pro` (tight, quiet) without a code change.
`ThemeWorldScope` does the same for theme worlds like space or ocean. Both nest.

## What it does not do

**No translation.** Labels are props — `QuizLabels`, `ResultLabels`, `SpeechLabels`, and friends. The
`locale` prop on `QuizShell` only picks a language out of per-locale content maps such as
`{ en, vi }` in the question data; it does not translate the shell's own copy. Copy lives in your app.

**No grading, no session state.** `quizReducer`, `quizSummary`, `revealFor`, XP and streak math, stroke
scoring, and the content schemas all live in `@bingoo.ai/core`. This package renders them. A React
Native renderer could share the same logic unchanged.

**No design tokens.** Colours, radii, shadows, and motion come from `@bingoo.ai/tokens`, generated from
one `tokens.json`. Components only read semantic CSS variables — never a hex value.

**No data access.** No fetching, no API client, no auth, no routing. Pass runtime data in as props.

**Web only.** React DOM 19, built on React Aria Components for the overlays and focus behaviour. Nothing
here runs under React Native.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

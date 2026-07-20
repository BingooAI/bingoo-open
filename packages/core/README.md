<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/core

Define a quiz as plain data, grade it, and drive the whole session — 55 question types, no UI
framework involved.

Reach for this when you need question data that survives a round trip through JSON, a database, or an
LLM, and grading that gives the same answer on the server and in the browser. Everything is a Zod
schema, so one definition gives you the TypeScript type, a validator for untrusted input, and a JSON
Schema you can hand to a model as a structured-output spec.

Beyond quizzes it holds the small shared pieces the rest of the platform keeps needing: spaced
repetition (`srs`), streaks and XP and leagues (`streak`, `xp`, `reward`), the declarative content
block schema (`content`), localized text (`localized`), age tiers (`age`), media vocabulary
(`media`), and the geometry behind the 3D-solid and net questions (`solid3d`, `nets`).

## Example

```ts
import { initQuiz, quizReducer, quizSummary, type QuizQuestion } from '@bingoo.ai/core'

const questions: QuizQuestion[] = [
  {
    id: 'q1',
    type: 'single',
    prompt: { en: 'Which animal is a mammal?', vi: 'Con nào là động vật có vú?' },
    choices: [
      { id: 'a', label: { en: 'Dolphin', vi: 'Cá heo' } },
      { id: 'b', label: { en: 'Shark', vi: 'Cá mập' } },
    ],
    answerId: 'a',
  },
]

let state = initQuiz({ questions, lives: 3 })
state = quizReducer(state, { type: 'respond', response: { type: 'single', choiceId: 'a' } })
state = quizReducer(state, { type: 'check' })
state = quizReducer(state, { type: 'next' })

quizSummary(state).accuracy // 100
```

`quizReducer` is a plain reducer, so it drops into `useReducer`, a store, or a server handler
unchanged. To grade one answer without a session, call `gradeQuestion(question, response)` — it
returns `{ correct, score }` with partial credit on `multiple`, `fill`, `order`, `match` and friends.

For untrusted input (model output, an import file), `safeParseQuiz(data)` validates it and
`quizJsonSchema()` gives the schema to generate against. `AUTHORABLE_SCHEMAS` does the same for the
other authorable kinds: content, lesson, flashcard deck, course, tracing glyph, coloring picture.

## What it does not do

- **No rendering.** Nothing here draws a question. Components live in `@bingoo.ai/ui-web` and
  `@bingoo.ai/manipulatives`.
- **No translation.** Prompts and labels are authored data; `pickText(value, locale)` picks a string
  out of a `{ en, vi, … }` map. UI copy is the host app's job (`@bingoo.ai/i18n`).
- **No measurement.** `gradeQuestion` scores one answer against one question. Turning answers into
  mastery — BKT, Elo, rubrics, Beta-Binomial — is `@bingoo.ai/knowledge-engine`, reached through
  `@bingoo.ai/authored-item`.
- **No persistence and no network.** `QuizState` is a serialisable object; storing and syncing it is
  yours.
- **No moderation.** `safeParseQuiz` checks shape, not safety. Content headed for children still
  needs a moderation pass.
- **No lesson planning or generation.** That is `@bingoo.ai/plans`, `@bingoo.ai/authoring` and
  `@bingoo.ai/content-gen`.

## Purity

No I/O, no network, no platform imports — never `next/*` or `react-native`. Grading, the reducer and
the geometry are deterministic. The date-dependent helpers (`srs`, `streak`, `schedule`) take the
date as an argument; they default to `new Date()` for convenience, so pass one explicitly in tests.
The one exception is `mintPublicId`, which reads the Web Crypto CSPRNG by design.

## Installing

Not published to npm yet. Inside this monorepo, add `"@bingoo.ai/core": "workspace:*"` to your
package's dependencies and import from `@bingoo.ai/core`. The package exports TypeScript source
directly — there is no build step and no `dist`.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

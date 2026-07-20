<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/personalization

Turns one lesson plan plus a learner profile into a `GenerationSpec` — the order form a content
generator works from.

You wrote a plan once, for a concept. Your learners are not one learner: some need counters and open
hints, some are ready to be stretched, one wants everything to involve dinosaurs, one needs captions.
Re-authoring the plan per learner is the wrong move — the moment the plan varies, so do the standards,
and evidence collected under two different plans is no longer comparable. `contentPlan` keeps the plan
fixed and varies only the delivery: difficulty band, how much scaffolding starts open, concrete vs
abstract representation, pace, story theme, language, and which fading concepts to fold back in.

The whole surface is one function. Levels map to a fixed table, so the same persona always produces the
same spec:

| level | band      | range         | hints open | representation | pace     |
| ----- | --------- | ------------- | ---------- | -------------- | -------- |
| `L1`  | `easy`    | easy, core    | 3          | concrete       | slow     |
| `L2`  | `core`    | core          | 0          | pictorial      | standard |
| `L3`  | `stretch` | core, stretch | 0          | abstract       | fast     |

## Example

```ts
import { contentPlan } from '@bingoo.ai/personalization'
import type { EngineSnapshot, LearnerPersona, TeacherPersona } from '@bingoo.ai/personalization'
import type { LessonInstructionPlan } from '@bingoo.ai/plans'

const lesson: LessonInstructionPlan = {
  slug: 'math.number.add-within-20',
  version: 1,
  title: { en: 'Add within 20', vi: 'Cộng trong phạm vi 20' },
  teaches: ['math.number.add-within-20'],
  knowledgePoints: [], // KP targets, when present, are unioned into spec.targetKcs
}

const learner: LearnerPersona = { level: 'L1', language: 'vi', age: 7, interests: ['dinosaurs'] }
const teacher: TeacherPersona = { variants: ['story'], minutes: 30 }
const snapshot: EngineSnapshot = { fading: ['math.number.add-within-10'] }

const spec = contentPlan(lesson, learner, teacher, snapshot)
// spec.difficultyBand 'easy' · scaffolding.representationStage 'concrete' · pace 'slow'
// spec.variant 'story' (defaults to 'worksheet') · storyTheme 'dinosaurs'
// spec.reviewInserts ['math.number.add-within-10'] · language 'vi'
```

Pass the spec to `assembleLessonContent` in `@bingoo.ai/content-gen`, or to your own generator — a
`GenerationSpec` is plain data and nothing here cares who reads it.

## What it does not do

- **No content.** No prompts, no items, no payload. A `GenerationSpec` is an order, not a delivery.
  Filling it is `@bingoo.ai/content-gen` via `GeneratorPort` / `ExpositionPort` / `FlashcardPort`, with
  the LLM adapter injected by the host.
- **No standards, no cut scores.** What the lesson teaches, its success criteria and assessment
  blueprint stay in `@bingoo.ai/plans` and are read, never rewritten. L1 and L3 aim at the same target
  and are certified against the same bar; only the route differs.
- **No mastery maths.** `EngineSnapshot` is something you compute — `@bingoo.ai/knowledge-engine` gives
  you mastered / fading / frontier — and hand in. This package reads `fading` for review inserts and
  otherwise treats the snapshot as a fact.
- **No persona inference.** `level`, `interests` and `accessibility` come from your profile store. Nothing
  here watches behaviour and decides someone is an L1.
- **No selection or scheduling.** Which item comes next, and when a card is due, belong to the engine and
  the experience layer.
- **No translation.** `language` is carried through to the spec as a label for the generator to honour.

## Purity

No clock, no randomness, no I/O. `contentPlan` is a pure function of its four arguments; call it twice
with the same input and you get the same spec.

## Install

Private to the monorepo, not published to npm. Depend on it with `"@bingoo.ai/personalization":
"workspace:^"`. It exports TypeScript source directly — no build step.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

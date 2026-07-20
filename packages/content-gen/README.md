<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/content-gen

Takes generated items and tells you whether they match the spec they were generated from — every
target concept covered, every primitive registered, difficulty inside the band you asked for.

You have a `GenerationSpec` from `@bingoo.ai/personalization`: which knowledge concepts this lesson
targets, which difficulty band, how much scaffolding, which language. Something has to turn that into
actual questions, and something has to check the result before a learner sees it. The turning is yours
— an LLM call, a template engine, a bank you wrote by hand. This package is the interface you write
that against (`GeneratorPort`) and the check that runs on what comes back (`assembleBundle`).

A lesson holds three kinds of content and they are not interchangeable, so there are three ports with
the same signature. `GeneratorPort` makes assessment items: measurable, they become `Candidate`s and
produce evidence. `ExpositionPort` makes teaching blocks to read or watch — `measurable: false`, no
evidence. `FlashcardPort` makes review cards, scheduled per learner by SRS, also outside the evidence
spine. Only assessment goes through the check, because only assessment has something to be checked
against.

## Example

```ts
import { assembleBundle, bandOf } from '@bingoo.ai/content-gen'
import type { GeneratorPort } from '@bingoo.ai/content-gen'
import type { GenerationSpec } from '@bingoo.ai/personalization'

const kc = 'math.number.addition.add-within-10'

const spec: GenerationSpec = {
  targetKcs: [kc],
  variant: 'worksheet',
  difficultyBand: 'core',
  bandRange: ['easy', 'core'],
  scaffolding: { hintOpenLevel: 3, representationStage: 'concrete' },
  reviewInserts: [],
  language: 'vi',
  pace: 'slow',
}

// Yours. Returns AuthoredItem[] — itemKey, skills, difficulty, primitiveKind, payload.
const generator: GeneratorPort = { generate: (s, kc) => myModelAdapter(s, kc) }

const bundle = assembleBundle(spec, await generator.generate(spec, kc))
if (!bundle.approvable) console.log(bundle.issues) // EMPTY | MISSING_KC | UNKNOWN_PRIMITIVE
bandOf(1320) // 'easy' — under 1400 easy, over 1600 stretch, otherwise core
```

`approvable` is false when any issue has severity `error`: nothing generated, a target concept with no
item, a `primitiveKind` the registry does not know. Off-band difficulty is a `warn` — the bundle stays
approvable and you decide. Branch on `issue.code`, never on `issue.message`; the messages are
Vietnamese today and are meant to be rendered by the host anyway.

`assembleLessonContent(spec, teaching, assessmentItems, review)` bundles all three streams at once and
runs `assembleBundle` on the assessment stream only.

## What it does not do

- **No model, no vendor, no prompt.** `GeneratorPort` is three lines of interface. The adapter that
  actually calls a model lives in your app; nothing here knows a provider exists.
- **No item shapes and no grading.** The `AuthoredItem` envelope and the primitive registry behind
  `isKnownPrimitive` are `@bingoo.ai/authored-item`; the payload schemas are `@bingoo.ai/core`.
  `payload` is never read here.
- **No anchoring checks.** `assembleBundle` compares items against a spec, and that is all. Items with
  no skill, skills outside the graph, duplicate `itemKey`, measurable items with no grader — that is
  `validateItem` / `validateBank` in `@bingoo.ai/authored-item`. Run both.
- **No spec building.** `GenerationSpec` comes from `contentPlan` in `@bingoo.ai/personalization`;
  standards and cut scores come from `@bingoo.ai/plans`. This package consumes a spec, never writes one.
- **No mastery maths.** `bandOf` reads two thresholds off an Elo number. BKT, Elo updates and
  forgetting are `@bingoo.ai/knowledge-engine`.
- **No workflow.** Approval, splitting, regeneration and `STALE` propagation are
  `@bingoo.ai/authoring-workflow`. `approvable` is a fact reported, not a state stored.
- **No persistence, no moderation, no media.** Nothing is written anywhere, no output is screened for
  safety, and image or audio resolution is `mediaTargets` in `@bingoo.ai/authored-item` plus a host
  resolver.

## Purity

No clock, no randomness, no I/O. The port methods are `Promise`-returning because the adapter you
inject is async; the package itself makes no calls and has no runtime dependencies.

## Using it

Not published to npm. Inside this monorepo, depend on it with `"@bingoo.ai/content-gen": "workspace:^"`
and import from the package name — it exports TypeScript source directly, with no build step.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

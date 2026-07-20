<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/knowledge-engine

Turns a stream of "learner got this right/wrong" into a mastery estimate per skill, and answers
what to teach next, what is due for review, and what is missing before a goal.

Use it when you have a set of skills with prerequisite links and a log of attempts, and you want
numbers you can defend: `pKnown` from Bayesian Knowledge Tracing, an Elo `ability` that moves with
item difficulty, Beta-Binomial intervals, rubric aggregation, and Rasch-based cut scores for
certification. Every function is a pure function over data you pass in, so the same log always
replays to the same state — you can recompute a learner's history from scratch to check a number.

It works on slugs, not questions. A `Candidate` is a key, the skills it exercises and a difficulty —
whether that is a maths drill, a welding rubric or a reading passage is the host's business.

## Example

```ts
import {
  DEFAULT_POLICY,
  buildGraph,
  frontierComposite,
  observe,
  type SkillMastery,
} from '@bingoo.ai/knowledge-engine'

const graph = buildGraph({
  nodes: [
    { slug: 'add-within-10', title: { en: 'Add within 10' }, kind: 'KNOWLEDGE' },
    { slug: 'add-with-regroup', title: { en: 'Add with regrouping' }, kind: 'KNOWLEDGE' },
  ],
  edges: [{ from: 'add-within-10', to: 'add-with-regroup', mode: 'REQUIRED' }],
})

const params = { bkt: DEFAULT_POLICY.bkt, elo: DEFAULT_POLICY.elo }
const states = new Map<string, SkillMastery>()
states.set('add-within-10', observe(undefined, { skill: 'add-within-10', correct: true }, params))

frontierComposite(graph, states, DEFAULT_POLICY.mastery.threshold)
// [{ slug: 'add-within-10', kind: 'KNOWLEDGE', pKnown: 0.672, impact: 1 }]
// 'add-with-regroup' is withheld: its REQUIRED prerequisite is not mastered yet.
```

`observeAll` folds a whole log at once. `recordEvidence` is the guarded entry point for real writes —
it checks the write matrix (who is allowed to assert what), drops non-learner lanes, and dedupes by
`attemptId`. Beyond that: `gapsTo` and `pathTo` for goal planning, `remediationFor` when a learner
stalls, `dueForReview` and `selectNextItem` for sequencing, `certifyFramework` for pass/fail
reporting, and `learnerView` / `teacherView` / `supporterView` / `assessorView` as read models.

## What it does not do

**No storage.** The engine never touches a database. You load a `GraphData` and a map of
`SkillMastery`, call functions, persist the results. The interfaces in `ports.ts` (`GraphSourcePort`,
`CandidatePort`, `ItemStatPort`, …) are type declarations only — the engine ships no implementations.

**No grading.** `GraderPort` describes a grader; it does not contain one. Marking an answer, checking
free text or running a model belongs outside. `scoreRubric` only aggregates criterion scores you have
already produced.

**No content, no authoring.** Item banks, lessons and curriculum text are not here. Building the
competency graph from source material is `@bingoo.ai/authoring`; instruction plans are
`@bingoo.ai/plans`; item shapes are `@bingoo.ai/authored-item`.

**No prose.** Views return numbers and structures. Turning "pKnown 0.62, 4 attempts" into a sentence a
parent can read is `@bingoo.ai/explainer`; rendering it is `@bingoo.ai/ui-web`.

**No text for humans.** `SkillNode.title` is an opaque locale map the engine never reads, and error
messages are for developers. Nothing here is translated.

## Purity

No clock, no randomness, no I/O. Time is always a `Millis` argument (`atMs`, `nowMs`) — if you want to
know a learner's state last Tuesday, pass last Tuesday. Tie-breaks are deterministic: `fnv1a32`
hashing and insertion order, never `Math.random`. Inputs are never mutated; `observeAll` copies the
map it is given.

The golden tests in `test/golden/` pin exact numbers to four decimal places, so a change in behaviour
is a test failure rather than a drift nobody notices. Run them with `pnpm test`.

## Install

Not published to npm. Inside this monorepo, depend on it with `"@bingoo.ai/knowledge-engine":
"workspace:^"`. It exports TypeScript source directly — no build step, your bundler compiles it with
the rest of your app.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

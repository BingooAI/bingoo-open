<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/plans

The data shape of a lesson plan, and a checker that tells you what is wrong with one before anybody
teaches it.

A plan here is a course of units of lessons. Each lesson names the concepts it teaches, carries a
Knowledge Point per concept (the misconceptions to expect, the concrete → pictorial → abstract
representations to use, what counts as success), and splits into one arc of steps per concept. Every
concept reference is a slug in a competency graph, so the plan can be checked against the graph rather
than read and hoped over.

That check is the point. `planQuality` catches what a human writing at speed — or an LLM writing at
volume — gets wrong: a slug that is not in the graph, a lesson teaching something before its
prerequisite, an assessment measuring a concept the course never taught, a step whose brief is too vague
for a generator to do anything specific with, a concept with no practice. You get issue codes with
severities and a score, not prose. Errors block; warnings are for the reviewer to judge.

## Example

```ts
import { buildGraph } from '@bingoo.ai/knowledge-engine'
import { lessonStepWork, planQuality } from '@bingoo.ai/plans'
import type { CoursePlan, LessonInstructionPlan } from '@bingoo.ai/plans'

const graph = buildGraph({
  nodes: [
    { slug: 'count-to-10', title: { en: 'Count to 10' }, kind: 'SKILL' },
    { slug: 'add-within-20', title: { en: 'Add within 20' }, kind: 'SKILL' },
  ],
  edges: [{ from: 'count-to-10', to: 'add-within-20', mode: 'REQUIRED' }],
})

const lesson: LessonInstructionPlan = {
  slug: 'bridge-through-ten',
  version: 1,
  title: { en: 'Bridging through ten' },
  teaches: ['add-within-20'],
  knowledgePoints: [],
  kcArcs: [
    {
      kc: 'add-within-20',
      steps: [
        {
          slug: 'teach',
          role: 'teach',
          title: { en: 'Make ten first' },
          durationMin: 8,
          deliveryKind: 'explainer',
          brief: { en: 'Ten-frame for 7+5: fill to ten, then move the remaining 2.' },
        },
        { slug: 'check', role: 'assessment', title: { en: 'Check' }, durationMin: 5, deliveryKind: 'assessment' },
      ],
    },
  ],
}

const course: CoursePlan = {
  slug: 'number-y1',
  title: { en: 'Number, Year 1' },
  objectives: [],
  units: [{ slug: 'u1', version: 1, title: { en: 'Addition' }, concepts: ['add-within-20'], lessons: [lesson] }],
}

planQuality(course, graph).issues.map((i) => i.code) // ['LESSON_NO_ASSESSMENT', 'STEP_VAGUE']
lessonStepWork(lesson).map((w) => `${w.kc}:${w.step.slug}`) // ['add-within-20:teach', 'add-within-20:check']
```

## API

- `planQuality(course, graph)` — `{ issues, score, approvable }`. `approvable` needs zero errors and a
  score of at least 80. `hasBlockingIssue(quality)` is the error-only check.
- `coursePlanQuality(doc, shellUnitSlugs)` and `unitPlanQuality(doc, shellLessonSlugs)` — the same gate one
  level up, for the course and unit planning documents (big idea, transfer goal, sequence rationale,
  assessment strategy). They also catch units and lessons that were invented and ones that were skipped.
- `lessonStepWork(lesson)` — flattens `kcArcs` into an ordered list of `{ kc, arcIndex, stepIndex, step }`.
  This is what a generation runner iterates, dispatching on `step.deliveryKind`.
- `stepEmitsBankItems(step)` — true for `content`, `practice`, `assessment`; false for `explainer` and
  `reflection`.
- `stepsForState(arc, state)` / `stepServesState(step, state)` — a step with no `forStates` serves every
  learner state, so a single-path arc renders unchanged for `novice`, `gap`, `proficient` and `mastered`,
  while a branching arc filters down to the steps meant for that learner.
- `courseLessonTeaches(course)`, `collectAssessments(course)`, `assessmentObjectives(plan)` — the
  projections a host needs to wire plans into the engine.

## What it does not do

- **No presentation.** A plan says "teach bridging through ten with a ten-frame" and how long that step
  should take. It never holds a script, a story theme, artwork, or an actual question. Those are per-learner
  content, generated later by `@bingoo.ai/content-gen` from a spec that `@bingoo.ai/personalization` shapes.
- **No generation.** Nothing here writes a plan or calls a model. This package defines the shape a plan must
  take and judges the result. Producing plans from source material is `@bingoo.ai/authoring`.
- **No graph.** The competency graph, prerequisites, coverage and mastery live in
  `@bingoo.ai/knowledge-engine`. Plans only carry slugs into it; `planQuality` borrows the graph to check
  them.
- **No adaptive decisions at runtime.** `forStates` records which branch serves which learner state. Working
  out which state a given learner is in, and choosing the branch, is the decision engine's job, from the
  learner model.
- **No storage, no versioning workflow.** `version` is a number on the object. Persisting plans, approving
  them, and tracking what went stale is `@bingoo.ai/authoring-workflow` plus the host.

## Purity

No clock, no randomness, no I/O. Every function takes plans in and returns a verdict or a projection, so a
whole curriculum's worth of quality gating runs offline in tests. The only dependency is
`@bingoo.ai/knowledge-engine`, for `Slug` and the graph passed into `planQuality`.

## Install

Not published to npm. Inside this monorepo, add `"@bingoo.ai/plans": "workspace:*"` to your package's
dependencies. The package exports TypeScript source directly, with no build step.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

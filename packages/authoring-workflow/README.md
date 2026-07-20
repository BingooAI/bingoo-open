<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/authoring-workflow

Tracks where every piece of a course is in the authoring pipeline, and tells you what went out of date
when you re-approve something upstream.

Authoring a course is not one generation call. You ingest source material, build a framework, shape the
course, write plans, generate content, build assessments, publish. Each of those is reviewed by a human,
and each one feeds the next. The hard part is not the state machine — it is what happens when someone
edits the framework three weeks later. Everything downstream that was written against the old framework
is now wrong, and nothing tells you.

This package is the bookkeeping for that. Each step records the parent versions it was generated from.
Approving a step bumps its version. `propagateStale` then walks the graph and marks every step whose
parents have moved on, through as many layers as it takes — framework changes, plans go stale, content
built on those plans goes stale too. You get back a list of what needs regenerating instead of finding
out from a confused student.

## Example

```ts
import { applyEvent, pipelineHealth, propagateStale } from '@bingoo.ai/authoring-workflow'
import type { PipelineStep } from '@bingoo.ai/authoring-workflow'

const framework: PipelineStep = {
  id: 'fw-1',
  stage: 'framework',
  status: 'needs_review',
  version: 3,
  parents: [],
  builtFrom: {},
}
const plan: PipelineStep = {
  id: 'plan-1',
  stage: 'plans',
  status: 'approved',
  version: 1,
  parents: ['fw-1'],
  builtFrom: { 'fw-1': 3 },
}

const reviewed = applyEvent(framework, 'approve') // approved, version 3 -> 4
const steps = propagateStale([reviewed, plan]) // plan-1 was built from fw-1@3 -> 'stale'

pipelineHealth(steps).actionable // ['plan-1']
```

## API

- `applyEvent(step, event)` — one transition, returns a new step. Throws `WorkflowError` on an illegal
  move. `approve` bumps `version`; `invalidate` is a no-op while a step is `generating`, so a run in
  flight is never cut off mid-way.
- `propagateStale(steps)` — runs to a fixed point across the whole graph.
- `pinToParents(step, steps)` — call after a step finishes generating, to record which parent versions it
  actually consumed.
- `gateToStage(steps, stage)` — true when every step in earlier stages is approved.
- `pipelineHealth(steps)` — counts, `blocked` (failed ids), `actionable` (needs review, stale, or failed),
  and `ready`.
- `STAGE_ORDER` — the seven stages in order: ingest, framework, course_shell, plans, content, assessment,
  publish.

## What it does not do

- **No generation.** Nothing here calls an LLM. Turning source material into a framework is
  `@bingoo.ai/authoring`; turning a spec into a content bundle is `@bingoo.ai/content-gen`. This package
  only knows that a step named `plan-1` exists and what state it is in.
- **No payloads.** A `PipelineStep` carries an id, a stage, a status, a version and its lineage — never
  the plan or content itself. Those live in `@bingoo.ai/plans` and `@bingoo.ai/content-gen`.
- **No persistence, no queue, no retries.** Every function takes steps in and returns steps out. Storing
  them, running the jobs, and scheduling retries belong to the host — `apps/api` in this repo.
- **No permissions.** Deciding who is allowed to approve a step is the host's call, enforced server-side.
  `applyEvent` will happily approve anything you hand it.

## Purity

No clock, no randomness, no I/O, no dependencies. Same input, same output, every time — which is what
makes the staleness rules testable. Timestamps, if you need them, are the host's to attach.

## Install

Not published to npm. Inside this monorepo, add `"@bingoo.ai/authoring-workflow": "workspace:*"` to your
package's dependencies. The package exports TypeScript source directly, with no build step.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

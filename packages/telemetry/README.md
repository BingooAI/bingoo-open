<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/telemetry

Turns a session's raw UI events into the three numbers evidence needs about an attempt: how many hints
were opened, how many times the learner had already tried, and how long they took.

Your player emits events as the learner works — item shown, hint opened, answer submitted. Grading needs
more than the answer itself: an answer after two hints and a third retry is not the same evidence as a
first-try answer, and `@bingoo.ai/knowledge-engine` weighs `hintsUsed`, `retry` and `latencyMs` when it
computes confidence. Those numbers are not in any single event; they only exist in the gaps between
events. This package reads the stream and works them out.

It also draws the line the rest of the system depends on: **telemetry is not evidence**. Views and hints
are context, never observations of their own. Only `attempt_submitted` produces something that folds into
mastery, and `isEvidenceBearing` is the gate that keeps a scroll event from quietly becoming a
measurement.

## Example

```ts
import { attemptContext, isEvidenceBearing, withContext } from '@bingoo.ai/telemetry'
import type { EvidenceInput } from '@bingoo.ai/knowledge-engine'
import type { RawEvent } from '@bingoo.ai/telemetry'

const events: readonly RawEvent[] = [
  { kind: 'item_viewed', atMs: 1_000, sessionId: 's1', itemKey: 'q7' },
  { kind: 'hint_opened', atMs: 4_000, sessionId: 's1', itemKey: 'q7', hintLevel: 1 },
  { kind: 'attempt_submitted', atMs: 9_000, sessionId: 's1', itemKey: 'q7' },
]

const i = events.findIndex(isEvidenceBearing)
const ctx = attemptContext(events, i) // { hintsUsed: 1, retry: 0, latencyMs: 8000 }

const base: EvidenceInput = { skill: 'math.fraction.add', actor: 'LEARNER_SELF', correct: true }
const evidence = withContext(base, ctx) // base + hintsUsed, retry, latencyMs
```

`attemptContext` expects one session's events sorted ascending by `atMs`. `retry` counts earlier
submissions of the same `itemKey` in that session; `hintsUsed` counts only hints opened since the
previous submission of that item, so a second attempt is not charged for hints spent on the first.
`latencyMs` is omitted rather than guessed when the item was never viewed, or when the arithmetic would
come out negative.

## What it does not do

- **No event collection.** Nothing here listens, batches, retries or ships. Your player or host builds the
  `RawEvent[]`; how it gets to a server is yours.
- **No storage or ordering.** Sorting, sessionising and deduplicating happen before you call in. The
  package reads an array and returns a value.
- **No grading.** `correct`, `outcome`, `skill` and `actor` come from the grader — `@bingoo.ai/core` or
  `@bingoo.ai/authored-item` — and the host assembles the `EvidenceInput` base. `withContext` only adds
  the context fields to what you hand it.
- **No mastery maths.** BKT, Elo, confidence weighting and the fold into `SkillState` are
  `@bingoo.ai/knowledge-engine`. This package never changes how evidence is folded, only what it carries.
- **No analytics.** Engagement, time-on-task and session dashboards are downstream of the same raw events,
  but they are not this package's job.

## Purity

No clock, no randomness, no I/O. Every timestamp is passed in as `atMs`, so the same event stream always
yields the same context — which is what makes a disputed estimate re-derivable months later.

## Install

Not published to npm. Inside this monorepo, add `"@bingoo.ai/telemetry": "workspace:^"` to your
package's dependencies. The package exports TypeScript source directly; there is no build step.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

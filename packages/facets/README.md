<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/facets

Decide whether two knowledge components are the same one, by comparing structured fields instead of
sentences.

Curricula state knowledge as prose. What actually separates "count to 20" from "count to 100" is a
number buried in an English sentence, and "Add within 20" and "Cộng trong phạm vi 20" are one thing
written in two languages. Compare the sentences and you are guessing. This package moves the
distinguishing detail out of the sentence into fields, so "is this the same KC?" becomes a structural
comparison you can check by hand — no similarity threshold, no LLM in the loop.

Reach for it when you are pulling knowledge components out of several sources into one graph and need
to know which ones collapse together. `compareIdentity` answers `SAME`, `DIFFERENT`, or `UNKNOWN` and
never a score. `UNKNOWN` is a real answer: it means the structure does not settle it, so a human
decides. Merging two distinct KCs corrupts every piece of evidence hanging off them and raises no
error, so the default has to be "do not merge".

## The axes

`Facets` has seven optional fields. `bloom`, `transfer`, and `fluency` are closed enums — they mean
the same thing in every subject. `object` (what the knowledge is about), `channel`, `scope`, and
`representation` are open: their vocabulary is per-subject data, not code. A `DomainProfile` carries
that data — which axes a subject requires, which axes may prove a difference, and alias mappings like
`"sum" → "addition"`. Adding a subject is a row, not a release.

By default only `object` and `scope` can prove two KCs different (`DEFAULT_IDENTITY_AXES`). The rest
are judgement calls that drift between extraction runs — "explain" one time, "recognise" the next — so
a mismatch there yields `UNKNOWN` rather than a false split. A profile can promote an axis when the
subject warrants it: in languages, listening and reading really are different skills, so `channel`
belongs in `identityAxes`.

## Example

```ts
import { compareIdentity, facetKey, type DomainProfile } from '@bingoo.ai/facets'

const math: DomainProfile = {
  domain: 'math',
  requiredAxes: ['object', 'bloom'],
  aliases: { object: { sum: 'addition' } },
}

const cambridge = { object: 'Sum', scope: { max: 20 }, bloom: 'apply' } as const
const moet = { object: 'addition', scope: { max: 20 }, bloom: 'apply' } as const
const parity = { object: 'parity', scope: { max: 20 }, bloom: 'apply' } as const

compareIdentity(cambridge, moet, math).verdict // 'SAME' — alias and case normalised
compareIdentity(moet, parity, math).verdict // 'DIFFERENT' — result.axes is ['object']
compareIdentity(moet, { object: 'addition' }, math).verdict // 'UNKNOWN' — 'bloom' not declared

facetKey(moet) // deterministic string; group by it to find duplicates in one pass
```

Every result carries `axes` (which axes decided it) and `reason` (a sentence you can show a reviewer).

## What it does not do

- **No extraction.** It will not read a syllabus and produce `Facets`. That is `@bingoo.ai/authoring`,
  which calls LLM and vision models through ports.
- **No graph.** It holds no nodes, edges, slugs, or storage. `@bingoo.ai/authoring` builds and
  validates the graph — its duplicate-detection invariant is built on `compareIdentity` and
  `facetKey` — and persistence lives in `apps/api`.
- **No merging.** You get a verdict. Acting on it, rewriting the graph, and recording who approved it
  are the caller's job.
- **No scores.** No embeddings, no fuzzy matching, no thresholds to tune. A verdict is derived from
  declared fields or it is `UNKNOWN`.
- **No subject vocabulary in code.** There is no built-in list of maths topics or music notations.
  Open-axis values and their aliases arrive as `DomainProfile` data.
- **No measurement.** `transfer` and `fluency` here declare what a KC *is*, not how a learner is doing.
  Mastery estimation is `@bingoo.ai/knowledge-engine`.

## Purity

Pure TypeScript with no runtime dependencies: no clock, no randomness, no I/O. Same inputs, same
verdict, forever — which is what makes the identity rule auditable.

The package is `private` and not published to npm. Inside the monorepo, depend on it with
`"@bingoo.ai/facets": "workspace:*"`; it exports `src/index.ts` directly, so there is no build step.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

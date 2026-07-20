<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/authoring

Turns curriculum documents into a concept graph the rest of the toolkit can run on: extract concepts,
deduplicate them, mint stable slugs, compile to `GraphData`, and refuse to publish a graph that
contradicts itself.

Reach for this when you have a syllabus, a textbook or a national standard as pages of prose and need it
as nodes with prerequisite edges. Extraction calls out to your own LLM and vision adapters; everything
after it — dedup, slugging, compile, validate, invariant checks — is pure, so you can test the part that
matters without a model.

Nothing here publishes itself. `runIngest` returns a draft, `compileDraft` returns an engine-ready graph,
and `checkInvariants` reports what a reviewer must settle first. Merging two concepts that are not the
same concept splits a learner's evidence in two, permanently and without any error, so that decision
stays with a person.

## Example

```ts
import {
  checkInvariants,
  compileDraft,
  hasBlockingIssue,
  hasBlockingViolation,
  validateDraft,
  type IngestDraft,
} from '@bingoo.ai/authoring'
import type { DomainProfile } from '@bingoo.ai/facets'

const math: DomainProfile = { domain: 'math', requiredAxes: ['object'] }

const draft: IngestDraft = {
  concepts: [
    {
      tempId: 'c1',
      title: { en: 'Count within 20', vi: 'Đếm trong phạm vi 20' },
      kind: 'KNOWLEDGE',
      subject: 'math',
      facets: { object: 'counting', scope: { max: 20 } },
      evidence: [{ chunkId: 'p12', quote: 'Count on and back within 20.' }],
    },
    {
      tempId: 'c2',
      title: { en: 'Add within 20' },
      kind: 'KNOWLEDGE',
      subject: 'math',
      facets: { object: 'addition', scope: { max: 20 } },
      evidence: [],
    },
  ],
  edges: [{ fromTempId: 'c1', toTempId: 'c2', relType: 'PREREQUISITE', mode: 'REQUIRED' }],
  warnings: [],
}

const compiled = compileDraft(draft)
compiled.graph.nodes.map((n) => n.slug) // ['count-within-20', 'add-within-20']

const issues = validateDraft(compiled)
const violations = checkInvariants(compiled.graph, { profiles: { math } })
if (!hasBlockingIssue(issues) && !hasBlockingViolation(violations)) {
  // safe to write compiled.graph to your store
}
```

Slugs are minted from the English title regardless of source language, so a Vietnamese textbook and a
Cambridge scheme of work land on the same node instead of two nodes holding half the evidence each.

## Aligning a second framework

The first curriculum you import builds the concept vocabulary. The second should map onto it rather
than extract a parallel set. `structuralVerdict` decides from facet structure where it can, and says
`UNKNOWN` where it cannot — that residue is where an LLM or a person is worth spending:

```ts
import { requiresHuman, structuralVerdict } from '@bingoo.ai/authoring'

const verdict = structuralVerdict(
  { object: 'counting', scope: { max: 20 } },
  { object: 'counting', scope: { max: 100 } },
  math,
)
verdict.verdict // 'SUBSET' — a narrower scope is a separate concept with a prerequisite edge, not a merge
requiresHuman(verdict.verdict) // false; only SAME, OVERLAP and UNKNOWN need a reviewer
```

`proposeAlignment` wraps this into a reviewable proposal carrying the server-minted slug, the target
concept and a `needsHuman` flag.

## Invariants

`checkInvariants` runs eight checks over a graph before it is written. Errors block, warnings do not.

| Code | Caught                                     | Why it matters                                              |
| ---- | ------------------------------------------ | ----------------------------------------------------------- |
| I1   | two concepts with indistinguishable facets | a reviewer merges or adds a facet; the machine never merges  |
| I2   | a concept carrying `stage`                 | stage belongs to one framework; the concept sits in several  |
| I3   | an objective carrying facets (warning)     | objectives are statements, concepts hold mastery             |
| I4   | a `MAPS_TO` edge that is not `REQUIRED`    | certification would average instead of requiring every link  |
| I5   | an objective mapped to no concept          | no evidence can ever certify it                              |
| I6   | a cycle in the ordering edges              | there is no order to teach in                                |
| I7   | a title with no `en` entry                 | slugs are minted from it                                     |
| I8   | a missing required facet axis              | the subject's `DomainProfile` needs it to tell concepts apart |

## What it does not do

- **No LLM, OCR, HTTP or file parsing.** You supply `VisionPort`, `ConceptExtractorPort`,
  `EdgeProposerPort` and an optional `EmbeddingPort`; `runIngest` is the only async function here.
- **No persistence and no publishing.** Writing the graph, storing drafts and running the review gate
  belong to the host. `applyReview` applies decisions, it does not collect them.
- **No facet vocabulary.** `Facets`, `DomainProfile` and `compareIdentity` live in `@bingoo.ai/facets`;
  subject profiles are data, not code in this package.
- **No mastery, scheduling or certification.** That is `@bingoo.ai/knowledge-engine`, which consumes the
  `GraphData` produced here.
- **No lesson content.** Turning concepts into teaching material is `@bingoo.ai/plans` and
  `@bingoo.ai/content-gen`.

## Purity and installation

No clock, no randomness, no I/O outside `runIngest`'s ports. The same draft compiles and validates to the
same result every time, so invariant regressions are catchable in CI against real curriculum fixtures.

Packages in this repo export TypeScript source directly and none is published to npm yet. Inside the
monorepo, add `"@bingoo.ai/authoring": "workspace:^"` to your dependencies and import by name.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

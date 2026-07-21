<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/codecs

Read a published CASE framework into a capability graph, and move learner evidence in and out of an
LRS as xAPI statements.

Use `/case` when you have a standards package — Common Core, a national curriculum, anything from the
CASE Network — and want its objectives as nodes and edges you can teach against. Decoding never
throws away a mismatch: every coercion, dropped association type and dangling reference comes back in
a report you can show a curriculum lead before they trust the import.

Use `/xapi` when a player needs to write attempts somewhere a school can audit, or when you want to
fold statements already sitting in an LRS back into the engine. Emitting validates before the
statement leaves. Ingesting is forgiving on purpose: an LRS holds data from tools that know nothing
about competencies, and one unreadable statement must not cost a learner a session of evidence.

## Example

Decoding a framework:

```ts
import { readFileSync } from 'node:fs'
import { decodeCase } from '@bingoo.ai/codecs/case'

const { graph, framework, report } = decodeCase(JSON.parse(readFileSync('ccss-math.json', 'utf8')))

console.log(framework.slug, report.metrics['objectives'], report.metrics['prerequisites'])
for (const issue of report.issues) console.log(issue.severity, issue.code, issue.message)

// graph.nodes — one OBJECTIVE per CFItem, slugged `fw.<framework>.<slugified-code>`,
//               e.g. `fw.common-core-state-standards-for-math.1-oa-a-1`
// graph.edges — isChildOf becomes COMPOSES, precedes becomes PREREQUISITE
```

Emitting an attempt and reading it back:

```ts
import { answered, ingest } from '@bingoo.ai/codecs/xapi'

const statement = answered({
  actor: { learnerId: 'learner-42', homePage: 'https://school.example' },
  itemUri: 'https://school.example/items/add-within-20/3',
  correct: true,
  competencyUri: 'concept.addition.within-20',
  latencySec: 12.5,
  timestamp: '2026-03-01T09:15:00+07:00',
})

const { observations, skipped } = ingest([statement])
// observations[0].outcome === 1, .skillSlug === 'concept.addition.within-20'
// skipped holds anything unreadable, each with a reason
```

## Subpaths

There is no root entry. Import `@bingoo.ai/codecs/case` or `@bingoo.ai/codecs/xapi` — a player that
only emits statements should not pull the CASE decoder into its bundle.

This package and `@bingoo.ai/contracts` are the only two compiled with tsup, to ESM and CJS. The
other packages export TypeScript source directly.

## Purity

No clock, no randomness, no network, no filesystem. Timestamps and statement ids are supplied by the
caller — an emitter that read the clock would make a player's output untestable and a replay
impossible.

## What it does not do

- **Does not mint concepts from a framework.** Every `CFItem` becomes an `OBJECTIVE`, namespaced
  under `fw.`, and nothing else. Splitting an objective into the atoms it certifies is an authoring
  act needing a human; the `MAPS_TO` edges from objectives down to concepts come from Competency
  Studio, not from an importer.
- **Does not invent learning order.** CASE hierarchy is composition. `PREREQUISITE` edges appear only
  where a publisher wrote `precedes` — Common Core has 746 associations and not one.
- **Does not write CASE.** Decoding only, for now. There is no encoder on the public surface.
- **Does not talk to anything.** It will not fetch a CASE registry or POST to an LRS. You pass parsed
  JSON in and ship the statements yourself.
- **Does not score.** `ingest` yields `Observation` values; folding them into mastery is
  `@bingoo.ai/knowledge-engine`.
- **Does not define the exchanged types.** `GraphData`, `ValidationReport` and `Observation` live in
  `@bingoo.ai/contracts`. Only the wire formats — `CfItem`, `XapiStatement` — belong here, so that an
  erratum from 1EdTech or ADL changes this package and nothing else.
- **Is not an LRS client.** No state or agent profile API, no attachments, no signed statements.

## Status

Private to the monorepo, not published to npm. Depend on it with `"@bingoo.ai/codecs": "workspace:^"`.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

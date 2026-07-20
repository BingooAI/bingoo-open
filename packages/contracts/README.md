<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/contracts

The shared types and zod schemas everything else in the repo is spelled in: competency graphs,
evidence, content, teaching plans, assessments, and the ports between them.

Reach for this package when you are writing something that has to exchange data with the rest of the
family — an importer that produces a concept graph, a player that emits observations, a store that
serves either — and you want the shape checked at the boundary rather than three layers in. Every
schema is exported alongside its inferred type, so you can validate untrusted input with
`schema.parse` and use `Type` everywhere after that.

It is also where the rules that must not be re-litigated per repo are enforced: a `stage` is rejected
on anything but an `OBJECTIVE`, an `Observation` defaults to the learner lane and `LEARN` mode, and
`wellbeingPolicy` refuses `exposeRank: true`. Those are tests in `test/invariants.test.ts`, not prose.

## Example

```ts
import { isLearnable, methodFor, observation, skillNode } from '@bingoo.ai/contracts'

const node = skillNode.parse({
  slug: 'math.number.addition.combine-within-20',
  title: { en: 'Add within 20', vi: 'Cộng trong phạm vi 20' },
  kind: 'KNOWLEDGE',
  altitude: 'concept',
})

isLearnable(node.kind) // true — OBJECTIVE and OUTCOME would be false
methodFor(node.kind) // 'BKT_ELO'; a DISPOSITION would route to 'BETA_BINOMIAL'

const evidence = observation.parse({
  skillSlug: node.slug,
  outcome: 1, // [0,1], so partial credit and rubric levels use the same shape
  actor: 'TEACHER',
  at: 1_784_000_000_000,
})

evidence.subjectType // 'LEARNER' — filled by default
```

## What is in it

| Module        | What you get                                                                       |
| ------------- | ---------------------------------------------------------------------------------- |
| `refs`        | `slug`, `id`, `code`, `localizedText`, `semver`, `millis`, `elo`, `unitInterval`     |
| `competency`  | `skillNode`, `skillEdge`, `graphData`, `relType`, `altitude`, `isOrdering`           |
| `facets`      | `facets`, `domainProfile`, `bloom`, `alignmentProposal` — concept identity           |
| `framework`   | `framework`, `frameworkVersion`, `frameworkReport` — the standards overlay           |
| `evidence`    | `observation`, `skillState`, `skillSnapshot`, `gap`, `candidate`, `explanation`      |
| `content`     | `item`, `itemShape`, `contentPackage`, `mediaRef`, `reviewRecord`, `c2paManifest`    |
| `pedagogy`    | `teachingPlan`, `planNode`, `pedagogicalMove`, `teachingMethod`                      |
| `format`      | `learningFormat`, `teachingStep`, `wellbeingPolicy`                                  |
| `assessment`  | `testBlueprint`, `assessmentTest`, `grade`, `credential`                             |
| `profile`     | `learnerProfile` — concept attainment, exportable, no personal data                  |
| `xai`         | `suggestion`, `validationReport`, `moderationVerdict`                                |
| `providers`   | `GraphProvider`, `ObservationSink`, `MasteryProvider`, `ModelGateway`, `Repository`  |

`CONTRACT_VERSION` marks compatibility of the shapes themselves; it moves only when they stop being
mutually readable, which is less often than the npm version moves.

## What it does not do

- **No measurement.** BKT, Elo and Beta-Binomial folds are in `@bingoo.ai/knowledge-engine`. This
  package says what an `Observation` and a `SkillState` look like, never how one becomes the other.
- **No storage.** `Repository`, `ObservationSink` and `GraphProvider` are interfaces. Whoever owns the
  data implements them; there is deliberately no shared store package.
- **No standards serialisation.** CASE and xAPI encoding lives in `@bingoo.ai/codecs`, behind the
  `./case` and `./xapi` subpaths. QTI and C2PA mapping sits outside this package too.
- **No rendering and no translation.** `localizedText` carries strings an author wrote; it does not
  produce them. UI labels are the host's job — `@bingoo.ai/ui-web` takes them as props.
- **No ports that only one repo needs.** A port belongs here when two or more repos must agree on it.
  One repo's internal extension point stays in that repo.

## Purity

No clock, no randomness, no I/O. Time arrives as `Millis` you pass in, and `Id` is minted by whatever
store issues it. The only dependency is zod, and there are no outgoing edges to sibling packages — the
dependency graph starts here.

## Using it

Not published to npm. Inside the monorepo, depend on it as `"@bingoo.ai/contracts": "workspace:^"`.
Unlike most packages here it is built rather than consumed as source, so run
`pnpm --filter @bingoo.ai/contracts build` before typechecking a consumer.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

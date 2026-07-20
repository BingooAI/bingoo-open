# @bingoo.ai/contracts

> Releases below 0.2.0 were made from a separate repository, before this package moved into
> the monorepo. Pull request and commit references are kept for the record; they do not
> resolve to anything here.

## 0.2.0

### Minor Changes

- #10 `d06624a` Thanks [@khachuongvn](https://github.com/khachuongvn)! - **Breaking: the competency model is replaced.** Adopts the model established in the
  knowledge-engine line, after RFC 0001 found that `0.1.0` had been designed from a blueprint
  without checking the system this organisation already runs. See ADR 0004.

  A minor bump rather than a major only because the package is `0.x`, where minor may break. It
  is a full model replacement and should be read as one.

  **What changed**

  - Two orthogonal axes: `kind` (8 values — what a node _is_, and which instrument measures it)
    and `altitude` (5 — how coarse it is). Replaces `Domain` + KSD arrays, which conflated them.
  - Mastery lives **only at atomic concepts**. Everything above is derived on demand, so a
    roll-up can never disagree with the evidence beneath it.
  - `Slug` is the runtime key; `id` is what relations reference; `code` is display-only. Slugs
    and ids never leave the system — a learner sees `title`, a certificate speaks in `code`.
  - Six relations in two families. `PREREQUISITE·ENABLES·COMPOSES` build the DAG;
    `ALIGNS·VARIANT_OF·MAPS_TO` are lateral and never affect learning order.
  - `PrereqMode`: `REQUIRED` gates, `RECOMMENDED` only advises. Previously every prerequisite
    blocked, which over-gates a learner on the strength of a loose authoring edge.
  - Evidence is three-tiered: append-only `Observation` → materialised `SkillState` →
    `SkillSnapshot`. `SkillState` is a cache, rebuildable by replay.
  - Mastery is a vector — `pKnown`, `ability` (Elo), `fluency`, `transfer`, `independence` — with
    a derived Dreyfus band. `pKnown` is not `level`.
  - New `facets` module: the six axes that decide whether two concepts are the same thing, plus
    the alignment verdicts and the rule that `SAME`/`OVERLAP`/`UNKNOWN` require a person.
  - New `framework` module: `Framework` (stable line) versus `FrameworkVersion` (immutable
    release). Only `OBJECTIVE` nodes belong to a version, so publishing a standard never migrates
    learner state.
  - `profile` shrank by more than half. One shared concept graph beneath every standard means
    there is nothing to crosswalk — a framework report is a projection, not a migration.
  - **Dispositions are measured**, by Beta-Binomial frequency at low confidence. This reverses
    what `0.1.0` shipped as an unrepresentable state; see ADR 0005 for the ruling and for where
    the protection it replaced now lives.
  - `CONTRACT_VERSION` is 2.

  **Migrating from 0.1.0**

  There is no automated path, and the package has one known consumer. `competency-engine` is
  being rewritten alongside this. If you had started against `0.1.0`, the shape of the change is:
  competency URIs become slugs, `MasteryState` becomes `SkillState` keyed on an atomic concept,
  and anything reading `Domain`/KSD reads `kind`/`altitude` instead.

### Patch Changes

- #7 `1ab67ea` Thanks [@khachuongvn](https://github.com/khachuongvn)! - Correct two documentation claims that did not match reality.

  `providers.ts` told readers that standalone stubs come from `@bingoo.ai/test-utils`. That
  package does not exist, and the reference shipped inside the published `.d.ts`. What actually
  happened is better: each repo publishes its own stubs as a `/testing` subpath, as
  `@bingoo.ai/competency-engine/testing` does. A useful stub is shaped by the assumptions of the
  repo consuming it — the engine's stub framework carries a KSD decomposition and a disposition
  precisely so its own invariant tests have something to bite on. A shared package would have to
  know every repo's internals to be that useful, which is the coupling these ports exist to
  prevent.

  `PRODUCT.md §5` claimed nothing would be published until two repositories had used it, which
  is circular: no repository can depend on an unpublished package. The commitment now attaches
  to 1.0, where it belongs, and 0.x is published early on purpose.

## 0.1.0

### Minor Changes

- #1 `7264ec4` Thanks [@khachuongvn](https://github.com/khachuongvn)! - Initial contract: the ten modules the Bingoo framework family agrees on.

  `refs` (identity and versioning), `competency` (CASE — KSD structure, proficiency levels,
  thresholds, crosswalks and migration), `evidence` (xAPI — mastery, gaps, explanations),
  `content` (QTI/C2PA — items, shapes, review records), `pedagogy` (teaching plans, content
  requirements, pedagogical moves), `format` (learning formats and wellbeing policy),
  `assessment` (blueprints, tests, grades, credentials), `profile` (portable attainment and
  cross-framework transfer), `xai` (suggestions, validation, moderation) and `providers` (the
  cross-repo ports).

  Four ethical guarantees are encoded as unrepresentable states rather than validated rules:
  dispositions carry no numeric mastery, rankings cannot be exposed, child privacy is not
  configurable, and a published item requires a named human approver. See ADR 0003.

### Patch Changes

- #3 `ae00867` Thanks [@khachuongvn](https://github.com/khachuongvn)! - Align documentation with blueprint v3's shared-package layout. No type or schema changes.

  The five standard codecs are now reached by subpath from one package —
  `@bingoo.ai/codecs/case`, `/qti`, `/xapi`, `/c2pa`, `/credentials` — rather than existing as
  five separate packages. One name keeps the shared layer small; subpaths keep a consumer from
  bundling an XML parser it never imported.

  There is no shared store package. `Repository<T>` remains a port here, but every repo ships
  its own default adapter, and a real database is a deployment concern belonging to the App
  layer. A shared store would have put one storage abstraction in the dependency path of all
  eight repos, and the first one needing a transaction or a different consistency model would
  have bent it out of shape or forked it.

  Doc comments ship in `.d.ts`, so this is a patch rather than nothing.

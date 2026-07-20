# ADR 0004 — Adopt the knowledge-engine competency model

- **Status:** Accepted
- **Date:** 2026-07-20
- **Supersedes:** the competency model shipped in `@bingoo.ai/contracts@0.1.0`
- **Amends:** `docs/ARCHITECTURE.md` — every section describing competency, mastery or profile
- **Decides:** [RFC 0001](../rfc/0001-reconcile-with-the-knowledge-engine-model.md)

## Context

`0.1.0` was designed from the blueprint document without checking the model already running in
`knowledge-engine`, `bingoo` and `devup`. RFC 0001 tabulates ten conflicts between them.

The choice was not between two designs of equal standing. One has golden vectors, property
tests, an eight-stage authoring pipeline with human gates, and two real curricula ingested
(Cambridge 0844 and 0845). The other has one hand-written stub framework, written by the same
author as its only consumer, on the same afternoon.

## Decision

The established model wins on every disputed row. Specifically, `contracts 0.2.0` adopts:

- **Two orthogonal axes.** `kind` (`OBJECTIVE·OUTCOME·SKILL·KNOWLEDGE·PROCEDURE·BEHAVIOR·
  ATTITUDE·DISPOSITION`) says what a node *is*; `altitude` (`concept·skill·competency·outcome·
  role`) says how coarse it is. The blueprint's single `Domain` axis conflated the two.
- **Mastery only at the atomic concept.** Every level above is a derived function and is never
  stored. This is what makes a framework republication harmless and a roll-up auditable.
- **Ordering versus lateral relations.** `PREREQUISITE·ENABLES·COMPOSES` form the DAG and are
  cycle-checked at write time; `ALIGNS·VARIANT_OF·MAPS_TO` never affect learning order.
- **`PrereqMode`.** `REQUIRED` gates, `RECOMMENDED` warns. `0.1.0` made every prerequisite
  blocking, which over-gates a learner on the strength of an author's loose edge.
- **Slug as the runtime key**, id for edges, `code` for display and never for logic.
- **Only `OBJECTIVE` carries a framework version**, so publishing a standard never migrates
  learner state.

## Consequences

- **`0.1.0` is superseded within days of publication.** It has one known consumer, so the cost
  is contained now and would not be in a month. Publishing before surveying existing work is
  the mistake; correcting it quickly is the only part still in our control.
- Two questions this repo had filed as unresolved are answered by the adopted model rather than
  by us: framework republication mid-cohort, and cross-standard portability. The second is
  answered better than the crosswalk machinery it replaces — a shared concept substrate leaves
  nothing to translate.
- The blueprint keeps its authority over *architecture* — the eight-repo split, port discipline,
  open-standard I/O — and loses it over the *domain model*. A design document does not outrank
  a model that has met real data.
- The weakest-link roll-up that `0.1.0`'s engine arrived at independently is the same rule
  `compositeMastery` implements. Mild evidence that both lines of reasoning were sound, and the
  only part of the discarded work worth carrying forward.

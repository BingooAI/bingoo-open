# ADR 0006 — Six structural types stay duplicated, deliberately

- **Status:** Accepted
- **Date:** 2026-07-20
- **Relates to:** [ADR 0004](0004-adopt-the-knowledge-engine-model.md), which decided that
  contracts adopts the knowledge-engine model

## Context

ADR 0004 settled the *model*: where the two lines disagreed about what a competency is,
knowledge-engine won, and `contracts@0.2.0` adopted it. What it did not settle is whether
`knowledge-engine` should then stop defining those shapes itself and take them from contracts.

Twenty-five names existed in both packages. The obvious move was to delete one copy and
re-export the other.

Before doing that, a type-level probe asserted mutual assignability in both directions for every
overlapping name. Sixteen were identical. **Six were not:**

| Type | How contracts differs |
|---|---|
| `SkillNode` | `level` bounded to integers 1..5; carries `altitude`, `targetLevel`, `facets`, `code`, `source` |
| `SkillEdge` | `mode` and `weight` have zod defaults, so the inferred type requires them |
| `GraphData` | composed of the two above |
| `SkillSnapshot` | narrower field set |
| `Candidate` | narrower field set |
| `ItemStat` | narrower field set |

The direction of the mismatch matters: contracts is assignable *to* knowledge-engine, but not
the reverse. Contracts is **stricter**, not different. This is not two teams disagreeing; it is
one model written down twice, once loosely and once with its constraints made explicit.

## Decision

**The sixteen identical names are re-exported from contracts. The six structural types stay
defined in `knowledge-engine` until a separate change reconciles them.**

Re-exporting a type that is merely *similar* would have been the worst outcome available. It
looks like deduplication, reads as deduplication in review, and silently changes what the engine
accepts — a graph that loads today would start failing validation, or worse, a producer would
start emitting a shape that no longer satisfies a constraint nobody noticed was being enforced.

Two smaller decisions fall out of the same reasoning.

**The re-exports are `export type`.** They are erased at compile time, so `knowledge-engine`
keeps zero runtime dependencies and still runs in a browser with nothing installed. That
property is worth more than the last three duplicated symbols.

**`LEARNABLE_KINDS`, `ORDERING_RELS` and `isOrdering` therefore stay duplicated**, because
re-exporting a *value* would pull zod in behind contracts. A test asserts they still equal their
counterparts. Duplication a test watches is a smaller problem than a dependency an engine cannot
shed.

`EVIDENCE_ACTORS` stays local outright: contracts has no counterpart, and it is the vocabulary
of the write-permission matrix. Copying the list without the matrix would move the words and
leave the meaning.

## Consequences

- Duplication between the two packages fell from twenty-five names to nine.
- The remaining nine are now *known* — enumerated here, with the reason each one stayed.
- Reconciling the six is a real piece of work, not a cleanup. It means either loosening
  contracts (giving up constraints that were added on purpose) or tightening every producer of
  these shapes across authoring, the API and the admin app. That decision needs its own RFC,
  with the producers surveyed first.
- Until then, a caller passing a `knowledge-engine` graph to something expecting a contracts
  graph will not typecheck. That is the honest state of affairs, and preferable to a coercion
  that hides it.

## What would change this

A survey of every site that constructs a `SkillNode` or `SkillEdge`, showing how many already
satisfy the stricter shape. If most do, tightening the rest is a bounded piece of work and
contracts wins. If most do not, the constraints in contracts are aspirational rather than
descriptive, and they are the thing to revisit.

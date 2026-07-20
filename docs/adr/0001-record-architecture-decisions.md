# ADR 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-07-20
- **Supersedes:** nothing
- **Amends:** nothing

## Context

This package is the constitution of an eight-repository family. Its decisions are unusually
expensive to revisit: a shape adopted here is adopted by everyone, and reversing one means a
major version and a coordinated release across repos that may be maintained by different
people.

That makes the *reasons* more valuable than usual, and also more perishable. Six months after
a decision, the argument that produced it lives in a pull request comment nobody will find,
and the next contributor sees only the outcome. They then either preserve a constraint whose
purpose has expired, or remove one whose purpose is still load-bearing. Both are common; the
second is worse.

Doc comments carry the *local* reason for a field (ENGINEERING R7). They are the wrong place
for a decision that spans modules, weighs alternatives, or was genuinely close.

## Decision

We keep Architecture Decision Records in `docs/adr/`, in
[Michael Nygard's format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):
**Context · Decision · Consequences**. Files are named `NNNN-kebab-title.md` and numbered
sequentially.

An ADR is required when a change:

- alters `docs/ARCHITECTURE.md`;
- adds, removes or changes an ethical invariant;
- introduces or removes a dependency, or a hard-to-reverse structural commitment;
- makes a breaking change to a published shape;
- settles a trade-off a reasonable person would question later.

ADRs are **immutable once accepted.** A decision that turns out to be wrong is superseded by a
new ADR that says so and explains why, never edited to look right in hindsight. The record of
having been wrong is part of the value.

## Consequences

- A contributor can find out why a shape is what it is without archaeology through git.
- Reversing a decision requires articulating what changed, which is a useful bar.
- Some overhead on every significant change. Accepted deliberately: the overhead is smaller
  than the cost of one unnecessary major version across eight repositories.
- ADRs will accumulate, and some will be superseded. That is the intended end state, not
  clutter — the superseded ones are the ones that teach the most.
- A risk worth naming: ADRs can become a ritual that records decisions after they are made
  rather than while they are being made. If that happens, the process has failed and should be
  changed rather than performed.

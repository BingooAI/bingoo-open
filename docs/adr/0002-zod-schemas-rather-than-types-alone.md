# ADR 0002 — Zod schemas rather than types alone

- **Status:** Accepted
- **Date:** 2026-07-20
- **Supersedes:** nothing
- **Amends:** the source blueprint §C11.1, which specifies "types/interfaces, no logic"

## Context

The blueprint this repository implements is explicit: `contracts` holds *types and interfaces,
no logic*. Taken literally, that means hand-written TypeScript interfaces, zero dependencies,
zero bytes at runtime.

That position is a good one and was seriously held. Three candidate designs:

**Pure types.** Literally what the blueprint says. Zero dependencies — the strongest possible
form of R2 — and nothing to ship. The problem is what it leaves undone. Every boundary in this
family parses something from outside it: a CASE framework from a registry, a QTI bank from a
publisher, xAPI from a school's LRS, JSON produced by a language model. Each consuming repo
would need to validate that data, none would have a shared validator, and so each would write
its own. Eight validators for one contract will disagree, and the disagreements surface as a
`NaN` in a report card rather than as an error at the door.

**Split packages** — `contracts` for types, `contracts-schema` for validators. Consumers who
want zero runtime take the first. Rejected because two packages describing one contract must
be kept in lockstep by hand, and the failure mode is silent: they drift, and the type says one
thing while the validator checks another. That is precisely the class of bug this repository
exists to prevent.

**Zod schemas with inferred types.** One definition; the type is `z.infer<>` of the schema, so
the two cannot drift. One dependency. A type-only consumer imports the type and pays nothing
at runtime, because the import is erased.

## Decision

**Every shape is a zod schema; every type is inferred from it.**

```ts
export const masteryState = z.object({ /* … */ })
export type MasteryState = z.infer<typeof masteryState>
```

`zod` is the sole dependency and remains so (ENGINEERING R2), asserted by CI rather than by
review.

Two boundaries are held firmly, because they are what keeps this compatible with the
blueprint's intent:

1. **Parsing is not logic.** No algorithm, no I/O, no clock, no randomness enters this
   package (R3). A schema describes what valid data looks like; it does not do anything with
   it. The blueprint's rule was aimed at behaviour — at BKT and CASE parsing living in a
   shared package — and that prohibition stands unchanged.

2. **Ports stay plain interfaces.** `providers.ts` contains no zod, because behaviour cannot
   be parsed. Only the data crossing a port can be, and it already is.

## Consequences

- One dependency instead of none. `zod` is now a supply-chain surface for the whole family.
  Mitigated by CI dependency audit and provenance, but it is a real cost and the honest
  argument against this decision.
- The type and the validator cannot drift. This is the main thing bought.
- Validation is available at every boundary without a second package, and consumers who do
  not want it pay nothing — a type import is erased at compile time.
- Zod's own major versions become our problem. A zod 5 with breaking inference would force a
  major release here, which is a major release for eight repositories. Accepted knowingly.
- It opened a design possibility the types-only version did not have: **guarantees expressed
  as schemas**. `z.literal(false)` for `exposeRank` makes a harmful state unrepresentable in a
  way a hand-written `boolean` could not, and the ethical invariants became executable tests
  rather than documentation. This was not the reason for the decision, but it turned out to be
  the largest benefit.

If this package ever needs a second runtime dependency to express a shape, the split-package
option should be reconsidered rather than the dependency accepted — and this ADR superseded
rather than worked around.

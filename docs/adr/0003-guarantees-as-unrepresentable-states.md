# ADR 0003 — Ethical guarantees as unrepresentable states

- **Status:** Accepted
- **Date:** 2026-07-20
- **Supersedes:** nothing
- **Amends:** `docs/ARCHITECTURE.md` §5

## Context

The blueprint states four guarantees for the whole platform (§A7): a child's dispositions are
never quantified; no ranking that harms; a child's privacy is respected in what goes home; a
human approves anything a model produced before a child sees it.

They are stated as prose, in a document, with the instruction that CI should check them. The
question is what "check them" should mean in the one package every repository imports.

**Option A — document them.** Write the rules in ENGINEERING.md and review against them. This
is the default and it is what most projects do. It fails in a specific, predictable way: the
rule is followed until the week it is inconvenient. Then a competent engineer, under deadline,
satisfying a customer who wants a class leaderboard, finds a field called `exposeRank` and
sets it to `true`. They were not in the room when the reason was discussed. Nothing in the
code tells them.

**Option B — validate them.** Model the fields normally and reject the harmful values at
parse time, or in each repo's CI. Better, and still weak in the same place: a validation rule
is a line of code with an author, and the same deadline that motivated setting the flag
motivates relaxing the check. The harmful state is still *expressible*; it is merely
disapproved of.

**Option C — make them unrepresentable.** Spend the type system: `z.literal(false)` rather
than `z.boolean()`, a narrowed union rather than a runtime check on a wide one. There is no
`true` to set, and no check to relax — only a type error, in a package whose changes require
an RFC.

## Decision

**Where a guarantee matters, the harmful state is unrepresentable.**

| Guarantee | Mechanism |
|---|---|
| Dispositions are never scored | `MasteryState.domain` and `ProfileEntry.domain` are `MeasurableDomain` — `cognitive \| psychomotor`. `affective` exists in `Domain`, for describing and teaching, and is absent from everything that carries a number |
| No exposed ranking | `WellbeingPolicy.exposeRank` and `.exposeScores` are `z.literal(false)`; `.celebrate` is `z.literal('progress')`; `.protectStrugglers` is `z.literal(true)` |
| Child privacy is not a setting | `InteractionDesign.parent.childPrivacy` is `z.literal('strict')`; `peer.exposeScores` is `z.literal(false)` |
| A person approves what a child sees | `Item` refines: `lifecycle: 'published'` requires a `ReviewRecord` with `decision: 'approved'` and a named human in `by` |

Each has a test asserting the **harmful input fails to parse**, in a dedicated file with its
own CI job so that a failure names itself rather than hiding inside a generic red X.

Two of the four use `.refine()` rather than a narrowed type — `Item` and `Grade` — because
their rule is relational rather than about a single field's domain: *published implies
reviewed*, *final and llm implies approved*. A discriminated union could express those in the
type system, at real ergonomic cost to every consumer, for a rule checked at one boundary
anyway. These two are the weaker pair and this ADR says so rather than implying uniformity.

## Consequences

- The guarantees survive contact with deadlines. That is the entire point.
- **This package becomes opinionated in a way a neutral schema library is not.** A product
  that publicly ranks children cannot use `WellbeingPolicy`; they must define their own type
  and lose interoperability with the format library. We accept being un-adoptable there.
- Some legitimate use is caught in the net. A researcher studying affective outcomes with
  consent cannot express a numeric disposition in `MasteryState`. That is a real cost. It is
  accepted because the failure mode on the other side — a school publishing "72% diligence"
  about a nine-year-old — is worse and less reversible than the inconvenience.
- Relaxing any of these requires changing this package, which requires an RFC and a major
  version. The friction is the feature: it forces the conversation that Option A skips.
- A determined implementer can still construct the object in TypeScript without parsing it.
  These types stop the harm being reached *by accident, or by a small decision made under
  pressure* — which is how it actually happens — not a deliberate adversary. Claiming
  otherwise would overclaim, and PRODUCT.md §3 says so plainly to users.

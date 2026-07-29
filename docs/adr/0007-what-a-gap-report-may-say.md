# ADR 0007 — What a gap report may say

- **Status:** Accepted
- **Date:** 2026-07-25
- **Discharges:** [ADR 0005](0005-dispositions-are-measured.md) consequence 2, which deferred
  enforcement to "the reporting layer when that layer exists"
- **Decides:** how a learner's standing against a framework is rendered to a teacher

## Context

ADR 0005 ruled that dispositions are measured, and moved the protection it displaced to the
reporting surface rather than removing it:

> **Rendering a disposition as a bare percentage to a learner or a parent remains out of
> bounds.** This ADR does not authorise it, and any surface that wants to needs its own
> decision and its own record.

It then noted that the enforcement "will be enforced at the reporting layer when that layer
exists". No such layer existed, so for a year the commitment had nowhere to live. A gap
report — what a learner has and has not reached against a framework — is that layer, and it
cannot be built without settling the question.

Two things forced the decision at the same time.

**A number can be honest about its own thinness, or it can hide it.** Concept mastery from
correct/incorrect responses carries a defensible interval: thin evidence produces a wide one.
A disposition measured by Beta-Binomial frequency carries an interval too, but the quantity
underneath is *how often a behaviour was observed*, not *how much is retained*. Printing 40%
next to "works well in a group" reads as a property of the child. It is a property of how
many times someone happened to be watching.

**"Not achieved" was hiding two different instructions.** The existing report
(`apps/api/src/repos/crosswalk.repo.ts`) answered with a set membership test: the learner
either has the concept or does not. A teacher reading "not achieved" cannot tell whether the
child was assessed and fell short, or was never assessed at all. Those call for opposite
next actions — teach, versus go and look. Collapsing them sends teachers to reteach material
a child may already have, while what nobody has examined stays unexamined.

## Decision

**A gap report renders by measurement method, and the data decides — not the caller.**

| Objective touches | Rendered as | Carries |
|---|---|---|
| only `KNOWLEDGE` / `PROCEDURE` / `SKILL` | a score | mastery **and** its confidence interval |
| any `DISPOSITION` / `BEHAVIOR` / `ATTITUDE` | evidence only | observation counts, never a score |

Ruled by Bingoo.ai on 2026-07-25.

Three parts of this are load-bearing.

**"Any", not "all".** An objective that mixes assessable concepts with observable ones is
rendered evidence-only in full. A composite number over both is not merely imprecise; it
looks precise while being about two incommensurable things.

**The interval is not optional.** Where a score is permitted it must be shown with its
interval. ADR 0005's first commitment was that "anything rendering a disposition must render
that uncertainty, not the point estimate alone". The same reasoning applies wherever evidence
is thin, so the rule is generalised rather than special-cased.

**"Not yet" and "no evidence" are separate outcomes.** Every unmet objective states which of
the two it is, and names the concepts under each. A report that cannot distinguish them is
not a report a teacher can act on.

## Consequences

- `gapReport` in `packages/knowledge-engine/src/views/gap.ts` computes `reportMode` from the
  kinds of the concepts an objective maps to. A caller cannot ask for a score on an objective
  that does not qualify, because there is no parameter with which to ask.
- The rule is enforced by construction, not by convention: for `evidence-only` objectives the
  `mastery` and `interval` fields are `null`. A surface that wants to print a percentage has
  nothing to print.
- `packages/knowledge-engine/src/domain.ts` gains `FREQUENCY_KINDS`, a local copy of what
  `methodFor` calls `BETA_BINOMIAL`. It is a copy because importing the value would make
  `contracts` a runtime dependency and pull zod in behind it; `contracts-alignment.test.ts`
  fails if the two ever disagree.
- The report language speaks about evidence and next actions rather than about the child.
  "No observations recorded for this objective yet" is a statement about the record. "Has not
  achieved co-operation" is a statement about a person, and this project does not make it.
- The older binary reader stays for the crosswalk case it was written for — reading framework
  B through the concepts a learner acquired under framework A, where no learner evidence is
  involved and set membership is the right question.

### What is still open

This ADR covers teachers. Learner-facing and parent-facing surfaces are **not** settled here;
ADR 0005 required them to have their own decision and their own record, and they still do.

`CONTRIBUTING.md` and `GOVERNANCE.md` state that character is never scored. That wording
still does not match ADR 0005, and this ADR does not repair it — it constrains what reaches a
teacher, not what the codebase measures. Reconciling the published guarantee remains open
(`docs/internal/TASKS.md` A1) and is the project owner's call, not a technical one.

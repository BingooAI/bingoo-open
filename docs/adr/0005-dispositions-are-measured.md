# ADR 0005 — Dispositions are measured

- **Status:** Accepted
- **Date:** 2026-07-20
- **Supersedes:** the A7 §1 invariant as implemented in `@bingoo.ai/contracts@0.1.0`
- **Decides:** [RFC 0001](../rfc/0001-reconcile-with-the-knowledge-engine-model.md) row 10

## Context

Two sources of authority said opposite things.

The blueprint, §A7.1: *"Không lượng hoá giá trị/thái độ. Dispositions chỉ quan sát **định tính**
qua tín hiệu hành vi. Không có '72% lòng yêu nước'."*

The established engine: `LEARNABLE_KINDS = ['KNOWLEDGE', 'SKILL', 'DISPOSITION']`, measured by
Beta-Binomial accumulated frequency at low per-event confidence.

`0.1.0` implemented the blueprint's position in the strongest available form — not as a
validation rule but as an **unrepresentable state**. `MasteryState.domain` admitted only
`cognitive` and `psychomotor`; there was no field in which a disposition score could exist.
`competency-engine` additionally threw `DispositionScoringError`. That is published.

It was also, in hindsight, a decision taken without the standing to take it. Writing a
guardrail into a type is a way of making a judgement permanent, and it was made from a design
document by an author who had not read the running system or asked the people responsible for
it.

## Decision

**Dispositions are measured.** `DISPOSITION` is a learnable kind and carries numeric mastery,
using the established method: Beta-Binomial frequency, low confidence per observation, never
graded right/wrong.

Ruled by Bingoo.ai on 2026-07-20, as decision owner for RFC 0001.

## Consequences

- `contracts 0.2.0` removes the narrowed measurable-domain union. The type-level prohibition
  and its tests are deleted, not weakened — a guardrail retained in a form nobody honours is
  worse than one removed on the record.
- `competency-engine` loses `DispositionScoringError`.
- Real curricula become expressible. Cambridge Primary English 0844 has dispositional
  objectives — "Enjoy and engage with books", "Take turns speaking". A model that could not
  hold them could not represent a framework we intend to support, which is the concrete cost
  the old position was imposing.

### What the blueprint was protecting, and what carries it now

The guardrail was not aimed at measurement. It was aimed at **a number about a child's
character reaching a parent** — a percentage printed next to "chăm chỉ" on a report.

Measuring an observed behaviour frequency at 0.2 confidence, as an internal teaching signal,
is a different act from publishing "72%". The decision permits the first. It does not, by
itself, say anything about the second.

So the protection moves rather than disappearing, and it now lives where the harm actually
occurs — the reporting surface. Three things follow, and they are commitments, not
suggestions:

1. The method carries its own honesty. Beta-Binomial at low per-event confidence produces
   wide intervals for exactly as long as the evidence is thin. Anything rendering a
   disposition must render that uncertainty, not the point estimate alone.
2. **Rendering a disposition as a bare percentage to a learner or a parent remains out of
   bounds.** This ADR does not authorise it, and any surface that wants to needs its own
   decision and its own record.
3. Credentials and formal grades are a separate question again, not settled here.

Points 2 and 3 will be enforced at the reporting layer when that layer exists — not, as
before, by making the underlying measurement impossible. Recorded here so the reasoning
survives the person who made the ruling, and so that removing the protection later has to be
an explicit act rather than an omission.

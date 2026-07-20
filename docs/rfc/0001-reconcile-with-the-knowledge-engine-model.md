# RFC 0001 — Reconcile `contracts` with the knowledge-engine model

- **Status:** **Accepted** — 2026-07-20. See §8 for the ruling as given.
- **Date:** 2026-07-20
- **Affects:** `@bingoo.ai/contracts` (published `0.1.0`), `competency-engine`, `codecs`, and every repo not yet written
- **Decision owner:** Bingoo.ai

---

## 1. What happened

`@bingoo.ai/contracts@0.1.0` was designed from the blueprint document and published to npm. It
was **not** checked against the competency model that already exists in this organisation:

| Where | What is there |
|---|---|
| `knowledge-engine/` | A complete academic core: BKT · Elo · Beta-Binomial · Dreyfus · Rasch/DIF/cut-score, evidence folding with idempotency, framework versioning and inheritance, graph frontier/path/remediation/prereq-gate, sequencer, authoring pipeline. Golden vectors and property tests. |
| `bingoo/` | 21 packages built on it — `facets` (KC identity axes), `authoring` (8-stage pipeline, I1–I8 invariants), `authoring-workflow` (state machine), `db` (Prisma), `apps/api`. |
| `devup/` | The same model in production shape: 4780-line Prisma schema, Cambridge 0844/0845 ingested, "learn once, report against many frameworks" demonstrated. |

That is a process failure against this repo's own constitution — `ENGINEERING.md §0.2`
("Reuse before creating. Search hard for what already exists"). The consequence is not
abstract: **there are now two contradictory definitions of "competency" in one organisation**,
which is precisely what this package exists to prevent.

This RFC exists to end that state deliberately rather than let the two drift.

---

## 2. Where the two models disagree

Every row is a real conflict, not a naming difference.

| # | knowledge-engine (established, running, tested) | contracts `0.1.0` (published) |
|---|---|---|
| 1 | **Two orthogonal axes**: `kind` (8 values) ⟂ `altitude` (`concept·skill·competency·outcome·role`) | One axis: `Domain` (3 values) + KSD arrays hung on a competency |
| 2 | **Mastery lives only at the atomic KC.** Every level above is a derived function, never stored | `MasteryState` keyed on competency + optional `ksdItemId` |
| 3 | Runtime key is **`slug`**; edges reference **`id`**; `code` is display-only and never in logic | `uri` is the single key |
| 4 | 6 relations, split into **ordering** (`PREREQUISITE·ENABLES·COMPOSES`, must stay acyclic) and **lateral** (`ALIGNS·VARIANT_OF·MAPS_TO`, never affect order) | CASE's set, undifferentiated |
| 5 | **`PrereqMode`**: `REQUIRED` gates, `RECOMMENDED` only warns | No such concept — every prerequisite blocks |
| 6 | **Only `OBJECTIVE` carries `frameworkVersionId`** → publishing a framework version never migrates learner state | `frameworkVersion` sits on every `MasteryState` |
| 7 | Multi-standard = **one shared concept graph**; each national standard's objectives `MAPS_TO` the same KCs. A learner switching systems keeps mastery because state attaches to the KC, not the standard | Crosswalk + `ProfileTransfer` between whole frameworks |
| 8 | Mastery is a **vector**: `pKnown` (BKT) + `ability` (Elo) + `fluency`/`transfer`/`independence` → derived Dreyfus band. `pKnown ≠ level` | A single `level: number` |
| 9 | KC identity decided by **facets** (6 axes; `object` and `scope` are the identity axes) | No identity model — two competencies differ if their URIs differ |
| 10 | **Dispositions are measured** — Beta-Binomial frequency, confidence ≈ 0.2, "never right/wrong". Real Cambridge objectives use it ("Enjoy & engage with books") | **Dispositions are unmeasurable by construction** — no field exists, and the engine throws |

Row 6 alone answers an open question `contracts` had filed as unresolved ("what happens when a
framework is republished mid-cohort"). The established model solved it years of thinking ago,
by making only OBJECTIVE version-bound.

Row 7 is a strictly better answer to portable profiles than the crosswalk machinery in
`profile.ts`: crosswalks translate *between* frameworks and lose fidelity at every hop, whereas
a shared KC substrate means there is nothing to translate.

---

## 3. The one question that is not technical

**Row 10 is an ethics decision and must be made by a person, not inferred from either document.**

The two sources say opposite things:

> **Blueprint §A7.1** — *"Không lượng hoá giá trị/thái độ. Dispositions chỉ quan sát **định
> tính** qua tín hiệu hành vi. Không có '72% lòng yêu nước'."*

> **knowledge-engine** — `LEARNABLE_KINDS = ['KNOWLEDGE', 'SKILL', 'DISPOSITION']`, measured by
> Beta-Binomial accumulated frequency, low confidence per event.

`contracts@0.1.0` implemented the blueprint's position as an **unrepresentable state** — there
is no field for a disposition score, and `competency-engine` throws `DispositionScoringError`.
That is now on npm.

Both positions are defensible, and they are not as far apart as they look:

- The blueprint is guarding against a **number about a child's character being published** —
  a percentage next to "chăm chỉ" on a report a parent reads.
- The engine is measuring **observed frequency of a behaviour**, at low confidence, as a
  teaching signal.

A possible reconciliation: dispositions may be *tracked* (frequency, internal, low confidence)
but may never be *reported as a score* — the constraint moves from the measurement layer to
the reporting and credentialing layer. That is a third option and needs to be chosen
explicitly, not assumed.

**This RFC does not resolve row 10. It asks for a ruling.**

---

## 4. Options

### A — knowledge-engine is the source of truth

`contracts` is rewritten to describe the established model (kind × altitude, slug keys, KC-level
mastery, 6 relations, PrereqMode, facets). `competency-engine` as written today is deleted;
`knowledge-engine` becomes the open-source engine. `competency-studio` is built to produce
graphs that engine already eats.

- **For:** one model, and it is the one with golden vectors and production data behind it.
- **Against:** `contracts 0.1.0` needs a major version; `codecs` needs its CASE mapping redone
  against `kind`/`altitude` rather than `Domain`/KSD; today's `competency-engine` is discarded.

### B — two parallel families, joined by an adapter

`contracts` stays as published; an adapter translates between the two models.

- **For:** nothing already published breaks.
- **Against:** it institutionalises the exact failure this package exists to prevent. Every
  future type has to be modelled twice, and the adapter becomes the place where mastery
  quietly changes meaning. **Not recommended.**

### C — merge: `knowledge-engine` *is* the blueprint's Competency Engine, opened

The blueprint's D5 "Competency Engine" and the existing `knowledge-engine` are the same
component; the blueprint described it, the engine implements it. `contracts` is rewritten to
describe the engine that exists, not the design document. Today's `competency-engine` repo
becomes either the open release of `knowledge-engine` or is archived.

- **For:** same single-model benefit as A, and it resolves the ownership question the family
  will otherwise keep re-asking: which repo *is* the Competency Engine.
- **Against:** same migration cost as A, plus a decision about what to publish from a codebase
  that was not written to be open-sourced (licence headers, docs, Vietnamese comments, and
  whatever is genuinely proprietary under §A6 open-core).

---

## 5. Recommendation

**Option C.**

The deciding argument is not elegance, it is evidence. `knowledge-engine` has golden vectors,
property tests and two real curricula ingested. `contracts 0.1.0` has one hand-written stub
framework that its author also wrote the consumer for. An open-source project that publishes a
model nothing has run is the fastest way to lose the credibility this family is being built to
earn.

The blueprint keeps its value — it is a better *architecture* document than anything in the
existing repos, and the eight-repo split, the port discipline and the open-standard I/O are
right. What it does not get to do is override a domain model that has already met real data.

**On row 10, my recommendation is the third path**: dispositions are trackable as low-confidence
frequency signals, and the prohibition moves to reporting — no disposition figure may appear in
an `Explanation`, a `Grade`, a `Credential` or a portable profile. That keeps the engine honest
about what it observes and keeps the guarantee where the harm actually happens. But this is the
row I am least willing to decide alone.

---

## 6. If C is accepted

1. **`contracts 0.2.0`** — a major rewrite, with an ADR per structural decision. Migration note
   for `0.1.0`: it has one known consumer (`competency-engine`), so the cost is contained if we
   move now. It will not be contained in a month.
2. **`codecs`** — CASE mapping redone: `CFItemType` → `kind`, hierarchy → `altitude`,
   `MAPS_TO` for objective→concept. The real-data work already done (Common Core decode, root
   items, the "no prerequisites in published frameworks" finding) carries over unchanged.
3. **`competency-engine`** — archived or replaced by the open release of `knowledge-engine`.
   The one thing worth salvaging is its documentation of *why* — the weakest-link rule it
   arrived at independently is the same rule `compositeMastery` implements, which is mild
   evidence both were reasoning correctly.
4. **`competency-studio`** — restarted against `facets`, the I1–I8 invariants, and the
   alignment adjudication rule ("is there a task a learner could get right on one and wrong on
   the other?"). Nothing of it has been committed, so there is nothing to unwind.
5. **Open-core boundary** — before publishing anything derived from `knowledge-engine`, decide
   under §A6 what stays proprietary: fitted BKT/IRT parameters, the Vietnamese framework
   content, tuned prompts.

---

## 7. What was asked

1. **A, B or C?**
2. **Row 10** — dispositions: not measured · measured · measured but never reported?
3. If C: does `knowledge-engine` get opened as-is, or re-implemented in the open with the
   proprietary parts held back?

---

## 8. The ruling

**Adopt the knowledge-engine model; keep `competency-engine` as the open-source repository;
re-implement in the open rather than publishing the existing codebase as-is.**

In the terms of §4 this is **C, with the second answer to question 3**. The open-source family
keeps its own repo names and its own release discipline, and `knowledge-engine` becomes the
reference implementation whose model, invariants and architecture the open engine follows.

What this settles:

- `contracts` is rewritten to the established model — `kind` × `altitude`, slug as runtime key,
  mastery only at the atomic KC, ordering versus lateral relations, `PrereqMode`, facets.
  Released as **`0.2.0`** with an ADR per structural decision.
- `competency-engine` keeps its name and repository, and is rewritten to follow the
  knowledge-engine architecture: pure and policy-driven, four layers, evidence folding,
  mode-aware composite roll-up, frontier / path / remediation, derived Dreyfus banding.
- Under §A6 open-core, what stays proprietary is what creates the moat and not the mechanism:
  **fitted BKT/IRT parameters, the authored Vietnamese frameworks, tuned prompts.** The
  algorithms, the graph, the invariants and the port surface are open.

### Row 10 — ruled: dispositions are measured

**Dispositions are measured**, following the established model: Beta-Binomial accumulated
frequency, low confidence per event, never scored right/wrong.

This reverses the position `0.1.0` shipped, and reverses it deliberately. See
[ADR 0005](../adr/0005-dispositions-are-measured.md), which records what the blueprint's
guardrail was protecting against and what now carries that protection instead.

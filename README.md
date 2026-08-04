# Bingoo Open

**Turn a curriculum document into lessons you can defend.**

Bingoo Open is a teaching toolkit you run yourself. Hand it a document — a national standard, a
textbook chapter, your own syllabus — and it works out what has to be learned and in what order,
drafts lessons against that map, and tracks what each learner actually got.

The part that matters: **every claim it makes opens up.** Click any concept, prerequisite or
objective and you see the sentence in *your* document that supports it, the page it came from,
and whether the machine proved the claim or merely guessed at it. Nothing is asserted without a
way to check it.

You run it on your own machine or server. No account, no per-seat pricing, no one else holding
your learners' data.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen.svg)](package.json)

[Tiếng Việt](README.vi.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

---

## What using it actually looks like

1. **Upload a document.** A PDF, a folder of scanned pages, or plain text.
2. **The machine reads it and drafts a map** — the concepts, which ones must come first, and the
   objectives the document states.
3. **You review it with the evidence open.** Every row shows what was claimed, the quote behind
   it, and checks that either passed or did not.
4. **You approve, or reject with a reason.** Rejections are kept, so the next person can see what
   was turned down and why.
5. **Lessons are drafted from the approved map**, and a person approves those too before a child
   sees them.
6. **Learners work through the lessons**, and every attempt becomes evidence with a timestamp and
   a source.

Steps 3 and 4 are the point. A machine reading a textbook will get things wrong; the question is
whether you can *see* that it did, before a child does.

## Evidence you can open

Here is what a reviewer sees for one objective pulled out of an uploaded document:

```
Objective   "Count to 20 and back"                             your file · page 12
  quote     "Học sinh đếm được đến 20 và đếm ngược từ 20."     found in the document
  check     covered by at least one concept                    ✔ passed
  check     those concepts are distinguishable from each other ✔ passed
  basis     FROM_SOURCE — the sentence is in your file, not invented

Prerequisite  "Count to 10"  ──▶  "Count to 20"
  check     the earlier skill is contained in the later one    ✔ passed
  check     the document teaches them in that order            ✔ passed
  basis     STRUCTURAL — derived from the map, not quoted
```

Three things are worth spelling out:

- **`basis` says where a claim came from.** `FROM_SOURCE` means the quote was located in the file
  you uploaded. `STRUCTURAL` means it follows from the map. `AI_INFERRED` means the model asserted
  it and nothing corroborated it — which is not forbidden, but it is labelled.
- **A found quote is not a proof.** Locating a sentence shows the sentence exists, not that it
  supports the claim. That judgement stays with you; the tool's job is to put the sentence in front
  of you rather than summarise it away.
- **Checks are re-run later.** A claim proved against one version of a document can quietly stop
  being true when the map changes underneath it. Opening a card re-checks it and tells you if the
  answer has drifted since it was recorded.

The same card shape covers seven kinds of claim: an objective exists, a concept exists, one thing
comes before another, an objective is covered, two concepts are the same thing, a lesson serves an
objective, and a new concept is proposed.

## Quickstart

```bash
git clone https://github.com/BingooAI/bingoo-open.git
cd bingoo-open
pnpm install
pnpm build     # packages resolve each other through dist/, so this comes first
pnpm dev
```

Requires **Node ≥ 22** and **pnpm ≥ 9**.

Three apps come up, with sample data already loaded so you can click through before configuring
anything:

| | Address | Who it is for |
|---|---|---|
| **Learner app** | `localhost:3000` | What a child and their parent see: lessons, practice, progress |
| **Staff console** | `localhost:3001` | Import curricula, review drafts with the evidence open, approve, see where a learner stands |
| **API** | `localhost:4000` | The server everything talks to |

Nothing external is needed to look around. You only need keys once you want the machine to read a
document of your own — see [Running it your way](#running-it-your-way).

## What's inside

Five frameworks, each usable on its own. Take the whole thing, or install one package and ignore
the rest. 21 packages, 3 apps.

| Framework | What it gives you | Packages |
|---|---|---|
| **Knowledge** | Competency graph, prerequisites, framework versioning, aligning two curricula against each other | `contracts` · `knowledge-engine` · `facets` · `authoring` · `codecs` |
| **Pedagogy** | Teaching plans, knowledge points, misconceptions, success criteria, per-learner adaptation | `plans` · `personalization` |
| **Teaching** | Lesson delivery engine and 67 interactive manipulatives | `explainer` · `explainer-web` · `manipulatives` |
| **Content** | Authoring and generation of exercises — 55 question types — plus an item bank with coverage tracking | `content-gen` · `authored-item` · `core` |
| **Learning** | Learner-facing modes, session flow, evidence capture | `experiences` · `learning-experience` · `telemetry` |

Shared across all five: `ui-web` (components), `i18n` (Vietnamese and English), `tokens` (theming,
light and dark), `db`, and an HTTP API.

**The 67 manipulatives** are the pieces a good teacher reaches for on paper — number lines,
base-ten blocks, fraction walls, bar models, balance scales, clocks, circuits, coordinate grids —
working in a browser and reusable across lessons.

**Measurement is method-matched, not one number for everything.** Knowledge and procedures are
estimated with Bayesian knowledge tracing and Elo. Skills are scored against rubrics by a person,
because a machine grading a skill without a rubric is guessing. Habits and dispositions are
reported as observed frequency with a confidence interval, and never rendered as a bare percentage
to a child or a parent — thin evidence is shown as thin, rather than rounded into false precision.

**Curricula come in as [CASE](https://www.imsglobal.org/activity/case)**, the open standard for
competency frameworks, so importing a national standard is not a bespoke job.

## Running it your way

Every external service sits behind a capability port — **nine** of them: AI model, vision, text to
speech, image generation, embeddings, translation, storage, search, cache. Each is a small
interface with swappable adapters, so changing provider is configuration, not a rewrite.

```bash
DEPLOYMENT_PROFILE=local     # or `cloud`
STORAGE_PROVIDER=s3          # a per-capability setting overrides the profile
```

**Cloud** is the fastest way to get running and what the default targets. Bring your own keys;
nothing routes through us.

**Local** matters if children's data has to stay on your premises, or you just do not want a
monthly bill. Coverage is not complete — image generation has no local adapter yet
([#14](https://github.com/BingooAI/bingoo-open/issues/14)) — and an unknown provider name is
rejected at startup rather than silently falling back to cloud.

The choice is per capability. Postgres on your own box while using a hosted model provider is a
normal setup, not a special case.

## Working with children

This is software for children, so some things are settled rather than configurable:

- **AI drafts; a person approves.** No generated content reaches a learner without someone saying
  yes to it.
- **Rankings and other learners' results are not put in front of a child.**
- **Habits and character are never reduced to a single score.**
- **Progress is explained to a parent, not graded for them.**

These are commitments, and [CONTRIBUTING.md](CONTRIBUTING.md) treats weakening one as grounds to
refuse a change. Where the code does not yet fully hold them, that is listed below rather than
quietly left out.

## What is not there yet

An honest list is more useful than a long feature table.

- **The sample learner page still ships a demo ranking board.** It runs on fixed sample data, so no
  real child is exposed — but it has to go before that page is pointed at real learners.
- **Exporting evidence out of the system is unfinished.** The [xAPI](https://xapi.com/) encoder is
  written and tested, but no route serves it yet, so "take your data and leave" is not something you
  can do today.
- **The learner app does not yet record how an answer was reached** — hints taken, retries, time —
  even though the model is built to weigh it.
- **A spoken answer is currently scored as correct if any recording exists**, silence included. Treat
  speaking exercises as unassessed until this is fixed.
- **Several menu entries in the learner app lead nowhere yet**, and the header search box and
  notification bell are not wired to anything.
- **The interface layer has no automated tests**, and neither does the grading engine.

Issues are tracked in the open at
[github.com/BingooAI/bingoo-open/issues](https://github.com/BingooAI/bingoo-open/issues).

## Status

Pre-alpha, and honest about it. The model behind this ran against real curricula and real classroom
data in a private codebase before being opened; package APIs will still change, and there are no
published npm releases from this repository yet.

Useful now if you want to read the model, disagree with it, or build on it early. Not yet something
to run a term of teaching on.

## Contributing

Issues and pull requests are welcome — including disagreement about the modelling, which is the most
useful kind. See [CONTRIBUTING.md](CONTRIBUTING.md). We use
[DCO](https://developercertificate.org/) sign-off (`git commit -s`), not a CLA.

Design decisions are recorded in [`docs/adr/`](docs/adr/), with the reasoning and the options that
were rejected — including the ones that were later reversed.

## Licence

Code is [Apache-2.0](LICENSE). See [NOTICE](NOTICE) for attribution and [TRADEMARK.md](TRADEMARK.md)
for what the Bingoo name and logo may be used for — the licence covers the code, not the brand.

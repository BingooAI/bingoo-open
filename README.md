# Bingoo Open

**Teach adaptively, and know whether it worked.**

Bingoo Open is a toolkit for people who teach: private tutors, freelance teachers, learning
centres and small schools. It helps you map what a learner needs to know, build lessons that
fit them, deliver those lessons interactively, and see — with evidence you can check by hand —
what actually stuck.

You run it yourself. There is no account to create, no per-seat pricing, and no vendor holding
your learners' data.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen.svg)](package.json)

[Tiếng Việt](README.vi.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

---

> **Status: assembling.** This repository is being put together from a working private
> codebase. `contracts` and `codecs` are in place; the teaching, content and learning
> packages are being migrated now. Nothing is stable yet — see [Status](#status) before
> depending on it.

## What you can do with it

**Map what has to be learned, in what order.** Import a curriculum — a national standard in
CASE format, a textbook, or your own syllabus — and get a graph of concepts with prerequisites
between them. The graph is what lets the system say "she cannot do this yet *because* she has
not got that", instead of just marking an answer wrong.

**Build lessons from that map.** Each concept carries what a teacher actually needs: the
misconceptions learners typically arrive with, the concrete → pictorial → abstract
representations that help, and what counts as success. Plans are generated as drafts; a person
approves them before a child sees anything.

**Teach with 67 interactive manipulatives.** Number lines, base-ten blocks, fraction bars, bar
models, balance scales, clocks, circuits, coordinate grids and more — the pieces a good teacher
reaches for on paper, working in a browser and reusable across lessons.

**Measure without pretending.** Every attempt becomes evidence with a timestamp and a source.
Knowledge and procedures are estimated with Bayesian knowledge tracing and Elo; skills are
scored against rubrics by a person, because a machine grading a skill without a rubric is
guessing. Habits and dispositions are reported as observed frequencies with a confidence
interval — never as a single score, and never mixed into an academic grade.

**Explain any number you show.** A mastery estimate can produce the claim, the evidence behind
it, the formula used, and what would have to change for it to read differently. If you cannot
explain a number to a parent, it does not belong on a screen.

## Quickstart

```bash
git clone https://github.com/BingooAI/bingoo-open.git
cd bingoo-open
pnpm install
pnpm dev
```

Requires **Node ≥ 22** and **pnpm ≥ 9**.

The web app comes up on `localhost:3000` with sample data, so you can click through a lesson
before configuring anything. Nothing external is required to look around.

## What's inside

Five frameworks, each usable on its own. Take the whole thing, or install one package and
ignore the rest.

| Framework | What it gives you | Packages |
|---|---|---|
| **Knowledge** | Competency graph, prerequisites, framework versioning, alignment between two curricula | `contracts` · `knowledge-engine` · `facets` · `authoring` · `codecs` |
| **Pedagogy** | Teaching plans, knowledge points, misconceptions, success criteria, per-learner adaptation | `plans` · `personalization` |
| **Teaching** | Lesson delivery engine and the 67 manipulatives | `explainer` · `explainer-web` · `manipulatives` |
| **Content** | Authoring and generation of items, six question types, item bank with coverage tracking | `content-gen` · `authored-item` · `core` |
| **Learning** | Learner-facing modes, session flow, evidence capture | `experiences` · `learning-experience` · `telemetry` |

Shared across all five: `ui-web` (components), `i18n` (Vietnamese and English), `tokens`
(theming, light and dark), `db`, and an HTTP API.

**Open standards, so your data stays yours.** Curricula come in as
[CASE](https://www.imsglobal.org/activity/case); learning evidence goes out as
[xAPI](https://xapi.com/). You can leave, and take the graph and the evidence with you.

## Running it your way

Every external service sits behind a capability port — 17 of them, covering storage, database,
LLM, text-to-speech, images, embeddings, email, cache, search, realtime and more. Each is a
small interface with swappable adapters, so changing provider is configuration, not a rewrite.

**Cloud** is the fastest way to get running, and what the default configuration targets. Bring
your own keys; nothing is routed through us.

**Local** matters if you handle children's data under rules that keep it on your premises, or
you simply do not want a monthly bill. Local adapters are a work in progress — the
[issue tracker](https://github.com/BingooAI/bingoo-open/issues) has the current coverage.

Either way the choice is per capability. Running Postgres locally while using a hosted model
provider is a normal setup, not a special case.

## Working with children

This is software for children, so a few things are settled rather than configurable:

- **AI drafts; a person approves.** No generated content reaches a learner without a human
  saying yes.
- **No leaderboards by default.** Rankings and other learners' scores are not exposed.
  Competition is opt-in and difficulty-matched.
- **Progress is explained to parents, not scored for them.**

## Status

Pre-alpha, and honest about it. The model behind this has been through real curricula and real
classroom data in a private codebase; this repository is the open reassembly of that work, in
progress. Package APIs will change. There are no published npm releases from this repository
yet.

Useful now if you want to read the model, disagree with it, or build on it early. Not yet
something to run a term of teaching on.

## Contributing

Issues and pull requests are welcome — including disagreement about the modelling, which is the
most useful kind. See [CONTRIBUTING.md](CONTRIBUTING.md). We use
[DCO](https://developercertificate.org/) sign-off (`git commit -s`), not a CLA.

Design decisions are recorded in [`docs/adr/`](docs/adr/), with the reasoning and the options
that were rejected.

## Licence

Code is [Apache-2.0](LICENSE). See [NOTICE](NOTICE) for attribution and
[TRADEMARK.md](TRADEMARK.md) for what the Bingoo name and logo may be used for — the licence
covers the code, not the brand.

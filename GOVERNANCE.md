# Governance

This document describes how decisions are made in this repository. It is deliberately short,
and deliberately honest about the current state.

## Where the project actually is

**Bingoo.ai is the sole maintainer today.** There is no independent foundation, no elected
technical committee, and no external maintainer with commit rights. Pretending otherwise
would be a governance theatre that collapses the first time a decision is contested.

What follows is therefore two things: the rules we hold ourselves to now, and the path by
which control is intended to spread. The second part is a commitment, not a description.

## Roles

**Contributor** — anyone who opens an issue, a discussion or a pull request. No prior
permission needed, no CLA to sign.

**Maintainer** — write access. Reviews and merges, cuts releases, triages security reports.
Listed in [MAINTAINERS.md](MAINTAINERS.md).

**Lead maintainer** — breaks ties, owns the release keys, is accountable for the ethical
invariants. Currently Bingoo.ai.

## How decisions are made

**Ordinary changes** — a fix, a doc improvement, an optional field. One maintainer's approval
merges it. Lazy consensus: if nobody objects within a reasonable window, it goes in.

**Contract changes** — anything in `packages/contracts` that adds a type, removes a field,
narrows a union or changes a default. These need a public discussion first (see
[CONTRIBUTING](CONTRIBUTING.md#before-you-start)), then an ADR recording what was decided and
what was rejected. A change there reaches every package at once; the discussion is the cheap
part.

**The ethical invariants** — dispositions unscored, no exposed ranking, child privacy strict,
a human between a model and a child. These are not ordinary technical decisions and are not
subject to lazy consensus.

Changing or weakening one requires: a public discussion, a superseding ADR, the lead
maintainer's explicit approval, and a major version. **"Make it configurable" is the specific
form of request we are least likely to accept** — the reasoning is in
[ADR 0003](docs/adr/0003-guarantees-as-unrepresentable-states.md).

We would rather lose an adopter than lose one of these. That is a governance statement, not a
technical one, which is why it is in this file.

## Becoming a maintainer

There is no quota and no timeline. What we look for: sustained, thoughtful contribution;
review that improves other people's work; and — most of all — good judgement about what does
*not* belong in this package, since that is the hard part here.

An existing maintainer proposes; the lead maintainer confirms. It is announced in a PR to
[MAINTAINERS.md](MAINTAINERS.md), so the change is public and reviewable.

Maintainers who become inactive are moved to an emeritus list after a quiet period, with
thanks and without drama. Access is a working tool, not an honour, and stale access is a
supply-chain risk.

## The commitment about control

Two things are structurally guaranteed rather than promised:

**No CLA.** Contributors keep their copyright and license under Apache-2.0. Without an
assignment, **this project cannot be relicensed or taken private later** — not by us, not by
an acquirer. That is the point of not having one, and it is irreversible in our favour.

**Apache-2.0, permanently.** BSL, SSPL and "open core with the useful parts removed" are not
options for this repository. If Bingoo.ai stops maintaining it, the licence is what lets
somebody else pick it up.

## When we disagree

Technical disagreement is normal and welcome; it belongs in the issue or the PR, in public.
Escalation goes to the lead maintainer, whose decision is final for now — and who should be
expected to explain the reasoning, not merely exercise the authority.

Conduct problems are not technical disagreements. They go to
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), which **is enforced**.

## Changing this document

By pull request, like everything else. Changes to the invariants section additionally require
the process described above for the invariants themselves.

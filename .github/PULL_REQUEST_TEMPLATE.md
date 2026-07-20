## What and why

<!-- What changes, and what problem it solves. The diff shows what; explain why. -->

## Blast radius

<!-- This package is imported by every repo in the family. Name which repos are affected and
     how. Say plainly whether it is a breaking change — an added optional field is not; a
     renamed field, a removed one, or a narrowed union is. -->

## How it was tested

<!-- What you actually ran, not what should pass. Include failure cases you tried. -->

## Checklist

- [ ] `pnpm check` passes (build · lint · typecheck · test)
- [ ] Tests added — a bug fix includes the regression test that would have caught it
- [ ] The type is needed by **two or more repos** (R1) — a single repo's type stays in that repo
- [ ] No new dependency; `zod` is still the only one (R2)
- [ ] No behaviour added — schemas and interfaces only, no algorithms, no I/O (R3)
- [ ] Every ethical invariant still holds and its test still passes (R5)
- [ ] Optional fields are written `?: T | undefined` where a hand-written type mirrors a schema
- [ ] Comments explain the constraint and the reason, not the shape (R7)
- [ ] SPDX header on new files
- [ ] `pnpm changeset` run — a public type changed, so consumers need the note
- [ ] Breaking change? → an RFC issue is open and linked, and an ADR is added (R6)
- [ ] Commits signed off (`git commit -s`), no tooling attribution

## Anything you are unsure about

<!-- Honesty here is genuinely more useful than a clean checklist. -->

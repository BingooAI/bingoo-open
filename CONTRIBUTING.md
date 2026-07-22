# Contributing

Thank you for considering it. This page covers how to get set up, what a good pull request
looks like here, and the few things we will not merge.

## Before you start

**For anything beyond a typo, open an issue first.** A rejected PR costs you an evening; a
short conversation does not. This is especially true for changes that cross package
boundaries, where the answer often turns on a design decision rather than on the quality of
the work.

If you are proposing something that changes how the model works — what a competency is, how
mastery is estimated, what counts as evidence — start a discussion and expect it to take a
while. Those decisions are recorded in [`docs/adr/`](docs/adr/) along with the options that
were rejected; reading the relevant one first will usually tell you whether your idea has
already been argued.

## Setting up

Requires [Node.js](https://nodejs.org) 22+ and [pnpm](https://pnpm.io) 9+.

```bash
git clone https://github.com/BingooAI/bingoo-open.git
cd bingoo-open
pnpm install
pnpm check
```

`pnpm check` runs build, lint, typecheck and test. Build comes first deliberately: packages
resolve each other through their `types` entry, which points into `dist/`, so typechecking a
clean checkout before building reports missing builds as `any` rather than as the error it
actually is.

`pnpm dev` starts the web app on `localhost:3000` with sample data.

Dev and production builds write to separate directories — `.next-dev` and `.next` — so
`pnpm build` and `pnpm dev` can run at the same time without corrupting each other.

If a page still throws `__webpack_modules__[moduleId] is not a function` or
`Cannot find module './vendor-chunks/…'`, the cache is stale: pnpm rewrites the
hashed paths under `node_modules/.pnpm` whenever dependencies change, and Next's
webpack cache can keep pointing at the old ones. Clear it:

```bash
rm -rf apps/*/.next apps/*/.next-dev .turbo apps/*/.turbo packages/*/.turbo
pnpm dev
```

## Where things go

The repository is organised as five frameworks — knowledge, pedagogy, teaching, content and
learning — plus shared UI, i18n and theming. The [README](README.md#whats-inside) has the
table. Two rules decide placement:

- **Pure logic goes in a package, not an app.** Anything that could be tested without a
  browser or a database belongs where it can be.
- **A type moves into `contracts` only when two or more packages must agree on it.** Not
  because it is elegant or reusable — because a shared type is a coordination cost, and one
  that only one package parses belongs in that package.

Before adding a module, component, hook or utility, look for an existing one. Duplicated logic
is the most common review finding here.

## Branches and commits

Branch from `main`: `feat/short-description`, `fix/…`, `docs/…`, `chore/…`.

[Conventional Commits](https://www.conventionalcommits.org/), e.g.
`feat(plans): add differentiation branches`. Use `feat!:` or a `BREAKING CHANGE:` footer for a
break.

**Sign off every commit** with `git commit -s` — the [DCO](https://developercertificate.org/),
which certifies you have the right to submit the code. We take **no CLA**, deliberately:
without one, this project structurally cannot be relicensed or taken private.

Commits are authored by the person who wrote the change, and by nobody else. No attribution
trailers of any kind.

**A PR that changes a published package needs a changeset.** Run `pnpm changeset` and commit
the result.

## What a good PR looks like

- **One logical change.** Two unrelated improvements are two pull requests.
- **Tests included.** For a formula, assert the numbers. For a guarantee, include a negative
  test proving the harmful input is *rejected* — a test that only shows good input is accepted
  proves nothing about a guarantee.
- **Both languages.** Any user-visible string goes through i18n with both `vi` and `en` filled
  in. A missing translation is a broken build waiting to happen.
- **Both themes.** UI changes use semantic tokens and are checked in light *and* dark.
- **A description that explains why.** The diff already shows what changed.
- **Honest about what you did not do.** "I did not check how this affects the admin app" is
  useful. A surprise later is not.

We review for correctness first, then design fit, then style. Expect questions — they are
about the code, never about you.

## The things we will not merge

This is software used by children, and four guarantees are enforced by making the harmful
state unrepresentable rather than merely discouraged:

- Dispositions and habits are never reduced to a score.
- Rankings and other learners' results are never exposed.
- Child privacy is not a setting.
- A person approves what a child sees.

They have their own tests and their own CI job. **A PR that weakens one will not be merged**,
and "make it configurable" is the version of the request we are least likely to accept — a
configurable guardrail is a guardrail that gets configured off. If you think one of them is
wrong, that is a genuinely interesting discussion, and it starts in an issue rather than a
diff.

## Reporting bugs

What you expected, what happened instead, and the smallest input that shows the difference. A
failing test is the most useful bug report there is.

**Security issues do not go in the issue tracker** — see [SECURITY.md](SECURITY.md).

## Licence

By contributing, you agree your work is licensed under [Apache-2.0](LICENSE), and your DCO
sign-off certifies you have the right to submit it.

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

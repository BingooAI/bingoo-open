# Changelog

Repository-level history, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Per-package release notes are generated from
[changesets](https://github.com/changesets/changesets) and live in each package's own
`CHANGELOG.md`.

## [Unreleased]

### Added

- Repository scaffold: pnpm workspace, turbo, tsup, vitest, ESLint, Prettier, changesets, CI.
- `packages/contracts` — the shared type and schema layer every other package agrees on.
  Zod schemas rather than bare types, so malformed data fails at the boundary it entered.
- `packages/codecs` — open-standard I/O. CASE for importing competency frameworks, xAPI for
  emitting learning evidence.

### In progress

- Migration of the teaching, content and learning packages from the private codebase:
  `knowledge-engine`, `facets`, `authoring`, `plans`, `personalization`, `explainer`,
  `explainer-web`, `manipulatives`, `content-gen`, `authored-item`, `core`, `experiences`,
  `learning-experience`, `telemetry`, `ui-web`, `i18n`, `tokens`, `db`, and the API, admin
  and web apps.

Nothing is published to npm from this repository yet, and package APIs will change. See the
[README](README.md#status) for what that means in practice.

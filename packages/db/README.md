<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/db

The Postgres schema behind a Bingoo deployment and the Prisma client that reads it — identity, media,
competency graph, evidence and authoring, in one migration history.

Use it from server code that has to touch stored data: an API route, a background job, a seed script.
You get `db`, one `PrismaClient` for the process, plus every generated model type, enum and the
`Prisma` namespace re-exported from the same entry point — so a data-access module needs a single
import line. `apps/api` works this way: one file per aggregate under `src/repos`, each mapping Prisma
rows to the types the pure packages speak.

Server-only, without qualification. The client carries your connection string and the query engine, so
importing it from `apps/web` or any browser bundle ships credentials to the browser.

## Example

```ts
import { db, Prisma } from '@bingoo.ai/db'
import type { CompetencyKind } from '@bingoo.ai/db'

export async function listSkills(kind: CompetencyKind) {
  return db.competency.findMany({ where: { kind }, select: { slug: true, title: true } })
}

export async function record(input: Prisma.ObservationCreateInput) {
  try {
    return await db.observation.create({ data: input })
  } catch (err) {
    // A duplicate is the caller's problem; an initialization error means the database is down.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return null
    throw err
  }
}
```

## Setup

The generated client is not committed, so run `pnpm --filter @bingoo.ai/db build` (`prisma generate`)
after install or nothing typechecks. Postgres needs the `vector` extension: two tables store 1536-dim
embeddings, and `MediaAsset.searchVector` is a generated tsvector column.

Three connection strings, documented in `.env.example`:

- `DATABASE_URL` — pooled endpoint, used by the runtime client through the pg driver adapter.
- `DIRECT_URL` — unpooled endpoint for the CLI. Migrate takes advisory locks that a PgBouncer pooler
  cannot hold. Falls back to `DATABASE_URL`.
- `SHADOW_DATABASE_URL` — a separate, disposable database Migrate wipes on every run to diff schema
  against history. Without it you cannot author migrations, only `db push`, which edits the real
  database and records nothing.

Then `db:migrate` in development, `db:deploy` in production, `db:studio` to browse.

## What is in the schema

| Area                 | Tables                                                                             |
| -------------------- | ---------------------------------------------------------------------------------- |
| Identity, orgs       | `User`, `Session`, `Account`, `Organization`, `Member`, `Team`, `Invitation`         |
| People, policy       | `Guardianship`, `Class`, `Relationship`, `AuditLog`, `RemoteConfig`, `*Profile`      |
| Media library        | `MediaAsset`, `MediaRendition`, `MediaGrant`, `Tag`, `Collection`, `MediaEmbedding`  |
| Knowledge, evidence  | `Competency`, `CapabilityRelation`, `Framework`, `Observation`, `SkillState`         |
| Content, authoring   | `ContentItem`, `SrsCardState`, `Course`, `AuthoringPlan`, `ExplainerLesson`          |

## What it does not do

- **No domain logic.** Repositories, services and validation belong to the app that owns them. This
  package stops at the query.
- **No measurement.** BKT, Elo and Beta-Binomial folds live in `@bingoo.ai/knowledge-engine`. A
  `SkillState` row is stored here and computed there.
- **No authentication.** Better Auth owns the write path for `user`, `session`, `account`,
  `verification`, `organization`, `member`, `invitation`, `team` and `teamMember`. Those field names
  mirror Better Auth 1.6 exactly so its Prisma adapter lines up — renaming one breaks sign-in.
- **No connection management to speak of.** `db` is created once and cached on `globalThis` outside
  production so a watching dev server stops leaking pools. The pg pool is lazy: constructing the
  client without a reachable database does not throw, the first query does.
- **Nothing for clients.** Browser and mobile code talks to the API and knows only
  `@bingoo.ai/contracts`.

## Using it

Not published to npm. Inside the monorepo, depend on it as `"@bingoo.ai/db": "workspace:^"`.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/api-server

The backend that puts the pure packages behind HTTP: a Hono server with sessions, role guards, a
Postgres layer, and nine swappable capability ports for the things that need a vendor.

Run this when you want the toolkit to serve real users. The teaching packages — `knowledge-engine`,
`plans`, `content-gen`, `explainer` — are deliberately pure: no clock, no randomness, no network.
That makes them testable, but it also means something has to hold the impure half. This app is that
half. It reads the clock, talks to Postgres, calls models, signs upload URLs, and enforces
authorization on the server where a client cannot argue with it.

It is also where vendor choice lives. Nine capabilities each sit behind a port with a registry of
adapters, so a laptop deployment and a hosted one are the same codebase with different config.

## Example

`createApp()` returns a plain Hono instance and opens no socket, so you can drive it directly —
this is how the tests exercise routes.

```ts
import { createApp } from './src/app'

const app = createApp()

const res = await app.fetch(new Request('http://localhost/health/providers'))
console.log(await res.json())
// { status: 'ok', profile: 'cloud', withoutLocalAdapter: ['image'], providers: [ … ] }
```

Inside a service, a capability is reached through the facade rather than a vendor SDK:

```ts
import { getAi } from './src/providers'

const { text, model, usage } = await getAi().generateText({
  system: 'Answer in one sentence.',
  messages: [{ role: 'user', content: 'What is a number line?' }],
})
```

`getAi()` with no argument returns whichever adapter the environment selected. Pass a key —
`getAi('openai')` — to pin one call to a specific vendor.

## Capability ports

`DEPLOYMENT_PROFILE` picks a sensible adapter for all nine at once; a per-capability
`<CAPABILITY>_PROVIDER` variable always wins over it, which is what makes a mixed setup ordinary
(Postgres and Redis on your machine, a hosted model for generation).

| Capability  | `cloud`      | `local`    | Override               |
| ----------- | ------------ | ---------- | ---------------------- |
| ai          | `claude`     | `openai`   | `AI_PROVIDER`          |
| vision      | `claude`     | `claude`   | `VISION_PROVIDER`      |
| image       | `openai`     | —          | `IMAGE_PROVIDER`       |
| tts         | `elevenlabs` | `openai`   | `TTS_PROVIDER`         |
| embedding   | `openai`     | `openai`   | `EMBEDDING_PROVIDER`   |
| storage     | `r2`         | `s3`       | `STORAGE_PROVIDER`     |
| search      | `postgres`   | `postgres` | `SEARCH_PROVIDER`      |
| translation | `llm`        | `llm`      | `TRANSLATION_PROVIDER` |
| cache       | `redis`      | `redis`    | `CACHE_PROVIDER`       |

`image` is the one gap: no adapter runs without a third-party account yet. Under
`DEPLOYMENT_PROFILE=local` it throws at startup naming the variable to set, rather than failing
later in front of a learner. `cache` is optional — an installation without it is smaller, not
degraded. `GET /health/providers` reports all of this at runtime.

## Layout

Requests go routes → services → repos, and nothing skips a layer. `src/routes/*` validate input with
zod and apply guards; `src/services/*` orchestrate and are the only callers of the pure packages;
`src/repos/*` are the only code touching the database. Vendor SDKs appear nowhere except
`src/providers/*/adapters/`. Mounted routers: `health`, `i18n`, `auth`, `children`, `classes`,
`students`, `orgs`, `relationships`, `communities`, `knowledge`, `authoring`, `media`, `explainer`,
`prompts`, `admin` — Better Auth owns `/api/auth/*` separately.

`pnpm dev` runs it on port 4000. `DATABASE_URL` is optional at boot so liveness probes work without
a database; queries then fail as 503. `BETTER_AUTH_SECRET` is required in production and the process
refuses to start without it.

## What it does not do

**No teaching logic.** Mastery estimation, item selection and evidence live in
`@bingoo.ai/knowledge-engine`; lesson structure in `@bingoo.ai/plans`; generation in
`@bingoo.ai/content-gen`; explanations in `@bingoo.ai/explainer`. Services call them, and adding a
pedagogical rule here instead of there is the mistake this boundary exists to prevent.

**No schema or SQL.** Prisma models, migrations and queries belong to `@bingoo.ai/db`. Repos call
it; nothing else does.

**No UI and no user-facing strings.** Rendering is `apps/web` and `apps/admin`. The API returns
data and error codes, not sentences to display.

**No trust in the client.** Every role check is a server-side guard in `src/auth/guards.ts`.
Platform, organization and class roles are independent axes — none inherits from another.

**Not on npm.** This app is `private: true` and runs from the monorepo. There is no
`npm install` for it.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/web

The app learners and parents actually open: marketing pages, sign-up and sign-in, a student and a
parent dashboard, and the surfaces where lessons get played.

This is the reference front end for the toolkit — a Next.js 15 App Router project that wires the
teaching packages into working screens. If you are running Bingoo for your own students, start here and
change what you need. If you are building your own front end instead, this app is the worked example of
how the pieces connect: locale-prefixed routing, server-side session gating against the API, design
tokens, and lesson playback.

Every route lives under `src/app/[locale]/`, so `/vi/learn` and `/en/learn` are both real URLs. The
next-intl middleware adds the prefix; nothing renders without a locale.

## Running it

```bash
cp apps/web/.env.example apps/web/.env.local   # NEXT_PUBLIC_API_URL, default http://localhost:4000
pnpm --filter @bingoo.ai/web dev
```

Needs `apps/api` running for anything behind a login. The marketing pages, `/learn` and `/explainer`
work without it — they render from local demo content.

## Routes

| Path                                              | What it is                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `/[locale]`                                       | Landing page                                                     |
| `/[locale]/learn`                                 | Learner surface — home / feed / arena / profile tabs             |
| `/[locale]/explainer`                             | Plays an authored `ExplainerDoc` end to end                      |
| `/[locale]/onboarding`                            | Grade and subject picker                                         |
| `/[locale]/login`, `/register`, `/reset-password` | Better Auth flows                                                |
| `/[locale]/student`, `/parent`, `/devices`        | Session-gated; redirect to `/login` when signed out              |
| `/[locale]/faq`, `/safety`                        | Static content                                                   |

The student and parent dashboards currently read from `src/lib/demo-data.ts`. They are laid out for real
data but not yet fetching it.

## Example

Adding a route behind the session gate — `requireSession` validates the cookie against the API and
redirects when there is no valid session, so nothing leaks before render:

```tsx
// src/app/[locale]/(app)/progress/page.tsx
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { requireSession } from '@/lib/session'

export default async function ProgressPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const { user } = await requireSession(locale)
  const t = await getTranslations('student')

  return (
    <section className="flex flex-col gap-2">
      <h1 className="font-display text-xl text-foreground">{user.name}</h1>
      <p className="text-foreground-muted">{t('hero.subtitle')}</p>
      <Link href="/learn">{t('hero.cta')}</Link>
    </section>
  )
}
```

Two rules that bite if you miss them. Import `Link`, `useRouter`, `usePathname` and `redirect` from
`@/i18n/navigation`, never from `next/*`, or the locale prefix is dropped. And call `setRequestLocale`
in every server page under `[locale]` so static rendering picks the right catalog.

## What it does not do

**It does not own authentication.** Better Auth runs in `apps/api`. Next proxies `/api/auth/*` to the
API (see `rewrites` in `next.config.mjs`) so the session cookie is same-origin and the server can read
it for route gating. That gate is a convenience; the API re-checks authorisation on every data call and
remains the real boundary.

**It holds no secrets and touches no database.** The only configuration is `NEXT_PUBLIC_API_URL`.
Database access lives in `packages/db`, AI calls in the API — neither is importable from here.

**It defines almost no UI of its own.** Components come from `@bingoo.ai/ui-web`, colours and spacing
from `@bingoo.ai/tokens`, translations from `@bingoo.ai/i18n` (add keys to both `vi.json` and
`en.json`). What lives in `src/components` is brand and layout glue: logo, mascot, theme toggle, app
shell, marketing sections.

**It does not run lessons.** Playback, timing and grading belong to `@bingoo.ai/explainer` and
`@bingoo.ai/explainer-web`; mode surfaces to `@bingoo.ai/experiences`; the interactive tools to
`@bingoo.ai/manipulatives`. This app supplies documents and labels, then gets out of the way.

**It is not the staff console.** Authoring, review and operations are `apps/admin`.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

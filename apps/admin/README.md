<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/admin

The desk where a person does the authoring work: browse and moderate the media library, build competency
frameworks and courses, generate lesson plans and items, and edit explainer lessons.

This is the human end of the pipeline the pure packages implement. `@bingoo.ai/authoring` can extract a
competency graph from a PDF and `@bingoo.ai/content-gen` can produce items, but somebody has to look at
the result, fix what the model got wrong, and approve it before a learner sees it. Run this app when you
have `apps/api` up and want a UI for that instead of curl.

## Running it

A Next.js 15 App Router app on React 19. Routes are locale-prefixed (`/vi/media`, `/en/media`) via
next-intl, with the locale list coming from `@bingoo.ai/i18n`.

```bash
pnpm --filter @bingoo.ai/admin dev    # http://localhost:3001
```

`API_URL` (or `NEXT_PUBLIC_API_URL`) points at the backend; it defaults to `http://localhost:4000`. Next
rewrites `/api/auth`, `/api/media`, `/api/prompts`, `/api/authoring` and `/api/explainer` to it, so the
browser only ever talks to this origin — same-origin session cookie, no CORS to configure. Uploads are
the exception: they go straight to storage with a presigned URL the API mints.

Getting past `/login` needs a staff account. `User.role` is a comma-separated set; the app recognises
`ADMIN`, `CONTENT_EDITOR` and `MODERATOR`.

## Example

A page is a file under `src/app/[locale]/(admin)/`. The layout has already gated the route to staff, so
the page only resolves capabilities and hands them down. This is the whole media page:

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@bingoo.ai/ui-web'
import { MediaBrowser } from '@/components/media/media-browser'
import { resolveCapabilities } from '@/lib/roles'
import { getServerSession } from '@/lib/session'

export default async function MediaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'admin' })
  const session = await getServerSession()
  const caps = resolveCapabilities(session?.user.role)

  return (
    <div className="space-y-6">
      <PageHeader title={t('library.title')} description={t('library.description')} />
      <MediaBrowser caps={caps} />
    </div>
  )
}
```

Client components read data through TanStack Query hooks that own their keys and invalidation —
`useSearch`, `useFolderAssets`, `useModerateAsset` in `src/lib/media-queries.ts`, and the authoring
equivalents in `src/lib/authoring-queries.ts`:

```tsx
const { data } = useSearch({ text: 'fraction bar', kind: ['IMAGE'], moderation: ['APPROVED'], limit: 24 })
```

For calls without a hook yet, `api.get` / `api.post` / `api.list` from `src/lib/api-client.ts` speak the
API envelope and throw a typed `ApiError` carrying `status`, `code` and the specific validation message.

## What it does not do

It does not authorize anything. `requireStaff` in the `(admin)` and `(fullscreen)` layouts is a real
server-side gate, but the API re-checks every request and enforces per-resource RBAC there. The helpers
in `src/lib/roles.ts` hide buttons the caller cannot use; they mirror the server and are never trusted.

It holds no database and calls no model. Extraction, generation, moderation scoring, embeddings and
storage all live behind `apps/api`. This app sends requests and renders DTOs.

It defines no content semantics. What a competency graph, a lesson plan, an item or an explainer document
*is* belongs to `@bingoo.ai/authoring`, `plans`, `content-gen` and `explainer` — bugs in the shape of
generated content are upstream of here.

It does not implement the explainer editor. `/studio` mounts `ExplainerStudio` from
`@bingoo.ai/explainer-web`; this app routes to it, persists what it emits, and stays out of the way.

It is not the learner app. Lessons, practice and progress are `apps/web`.

It is not fully translated. Media and shell surfaces go through `next-intl`, but several authoring pages
(`/authoring/align`, `/authoring/coverage`, the hub cards) still carry hardcoded Vietnamese titles —
unfinished work, not a design choice.

Not published to npm, and not meant to be — it is an application, not a dependency.

## Licence

Apache-2.0 — see [../../LICENSE](../../LICENSE).

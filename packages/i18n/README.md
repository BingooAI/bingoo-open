<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/i18n

The list of locales the platform supports, plus the full UI message catalog for each one — as plain
data, with no framework attached.

Reach for this when more than one thing needs to agree on what a valid locale is: a web app doing
locale-prefixed routing, an admin console, an API endpoint validating a `?locale=` query, a mobile
language picker. Adding a language means adding a code to `locales` and a matching
`messages/<code>.json`; every consumer picks it up without further edits.

The catalog itself is nested JSON — 1112 keys per locale under namespaces like `common`, `nav`,
`auth`, `learn`, `admin` — with `vi` and `en` kept at identical key sets. Strings are ICU message
format, so placeholders (`"{count} lessons"`), plurals and selects are all fair game for whichever
formatter you run them through.

## Example

```ts
import { defaultLocale, isValidLocale, localeMeta, locales, messages } from '@bingoo.ai/i18n'
import type { Locale, Messages } from '@bingoo.ai/i18n'

function resolve(requested: string | undefined): Locale {
  return isValidLocale(requested) ? requested : defaultLocale
}

const locale = resolve('en')

messages[locale].common.actions.getStarted // 'Start for free' when locale is 'en'
localeMeta[locale].native // 'English' — what a language switcher should display
localeMeta[locale].dir // 'ltr'
locales // readonly ['vi', 'en'] — feed a zod enum, a router, a picker
```

`Messages` is the shape of one bundle, derived from the default locale. Hand it to a typed
translation hook and every namespace and key is checked at compile time.

Wiring it into next-intl is four lines, and is exactly what `apps/web` and `apps/admin` do:

```ts
import { getRequestConfig } from 'next-intl/server'
import { defaultLocale, isValidLocale, messages } from '@bingoo.ai/i18n'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = isValidLocale(requested) ? requested : defaultLocale
  return { locale, messages: messages[locale], now: new Date() }
})
```

## What it does not do

- **No formatting.** Nothing here interpolates `{count}` or renders a message. Pass the catalog to
  next-intl, `@formatjs/intl`, or anything else that speaks ICU. Numbers, dates and relative times
  go through `Intl.*` at the app layer.
- **No machine translation.** Turning authored content into another language at runtime is a server
  concern — `apps/api` has a `translation` port and a cached `translateContent` above it. This
  package holds hand-written UI copy only.
- **No content strings.** Question prompts, lesson bodies and item feedback are authored data and
  carry their own `{ en, vi }` maps; `@bingoo.ai/core` reads them with `pickText`.
- **No routing.** Locale prefixes, middleware, cookies and the switcher component are app-level
  next-intl wiring built on top of `locales` and `defaultLocale`, not part of this package.
- **No component copy.** `@bingoo.ai/ui-web` is deliberately i18n-free — the host builds a label
  object from this catalog and passes it down as a prop.
- **No server-rendered user text.** The API returns stable error codes; clients map them to copy
  here.

## Purity

Zero dependencies. Two `.ts` files and two `.json` files, no clock, no I/O, no platform imports —
usable from Node, a browser bundle, a React Native app, or a test with equal indifference.

## Subpaths

`@bingoo.ai/i18n/messages/en.json` exposes a raw catalog file directly, for tooling that wants the
JSON without pulling in the module — a translation-memory sync, a key linter, a build step that
serves catalogs over HTTP.

## Installing

Not published to npm yet. Inside this monorepo, add `"@bingoo.ai/i18n": "workspace:*"` to your
package's dependencies and import from `@bingoo.ai/i18n`. The package exports TypeScript source
directly — there is no build step and no `dist`.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

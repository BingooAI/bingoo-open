<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/tokens

One JSON file of colours, type, radii, shadows and motion, compiled into a Tailwind v4 stylesheet for
web, a typed JS mirror, and a React Native theme.

Use it when you want light and dark themes, plus alternate skins, without writing conditionals in
components. Components reference semantic names — `bg-primary`, `text-foreground`, `border-border`. The
package resolves those names per theme through CSS variables, so switching themes is an attribute on an
ancestor element, not a re-render or a prop drill.

Edit `src/tokens.json`, run the build, and every target updates together. The generated files in `dist/`
are never edited by hand.

## Example

Web — import the stylesheet next to Tailwind, once, in your global CSS:

```css
@import 'tailwindcss';
@import '@bingoo.ai/tokens/css';
```

Then read the same values from TypeScript wherever CSS cannot reach — browser chrome, canvas, tests:

```ts
import { brand, themeColor, radius, font, type BrandColor } from '@bingoo.ai/tokens'

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: themeColor.light },
    { media: '(prefers-color-scheme: dark)', color: themeColor.dark },
  ],
}

const highlight = (name: BrandColor) => brand[name] // '#0645d6' for 'blue'
const cardRadius = radius['2xl'] // '2rem'
const displayFace = font.display // 'Baloo 2'
```

Themes and skins are driven by attributes. `data-theme="dark"` swaps the semantic layer, `data-pack`
picks a structural skin (`playful`, `calm`, `toy3d`, `junior`, `pro` — each sets card radius, button
depth, border width and a motion multiplier), and `data-accent` re-hues the primary family (`teal`,
`sunbeam`, `coral`, `grape`; blue is the default). They compose, and `prefers-reduced-motion` zeroes the
motion scale regardless of the active pack.

## Native

`@bingoo.ai/tokens/native` ships the same tokens resolved to concrete values, because React Native has
no CSS cascade. `themeVars.light` / `themeVars.dark` are `--color-*` maps you feed to NativeWind's
`vars()` on a wrapper view; `lightTheme`, `darkTheme` and `gradients` give raw colours for APIs that
demand them (StatusBar, LinearGradient); `packSkins` and `accentVars` expose the pack and accent knobs
as numbers and var maps. `@bingoo.ai/tokens/nativewind-preset` maps semantic class names onto those vars.

## Build

Unlike most packages here, this one is generated rather than exporting source directly:

```
pnpm --filter @bingoo.ai/tokens build
```

That reads `src/tokens.json` and writes `dist/tokens.css`, `dist/tokens.ts` and `dist/native/*`. Run it
before building anything that consumes tokens. Adding a theme, pack or accent means adding a block to
`tokens.json` — no component changes.

## What it does not do

- **No components.** No button, card or layout lives here. Those are in `@bingoo.ai/ui-web`.
- **No theme switching.** The package defines what `dark` means, not when it applies. Persisting a
  choice and stamping `data-theme` is the app's job (both apps here use `next-themes`); scoping
  `data-pack` / `data-accent` to a subtree is `PackScope` in `@bingoo.ai/ui-web`.
- **No theme worlds.** The richer per-subject skins keyed on `data-theme-pack` are defined in
  `@bingoo.ai/ui-web`, not here.
- **No runtime.** Nothing is computed at request time. The outputs are a stylesheet and frozen
  constants; there is no clock, no randomness, no I/O.
- **No Tailwind.** This is a stylesheet you import alongside Tailwind, not a replacement for it.

This package is `private` and is not published to npm. Inside the monorepo, depend on it with
`"@bingoo.ai/tokens": "workspace:*"`.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

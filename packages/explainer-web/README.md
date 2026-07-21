<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/explainer-web

Plays an explainer lesson in the browser: a React player that draws the engine's frames to SVG, speaks
the narration, and stops at checkpoints until the learner answers.

Give it a compiled `ExplainerDoc` and its locale bundles and you get a working lesson surface —
play/pause, scrubbing, captions with word-level highlighting, 16:9 / 9:16 / side-by-side, and
interactive manipulatives the learner can drag. Playback is a pure function of one number, `t`, so the
same document renders identically in the player and in the editor preview.

Use it when you have explainer documents (authored by hand, or generated) and want to show them.
Everything below the drawing layer — schema, layout, timing — belongs to `@bingoo.ai/explainer`; this
package is the part that knows what a browser is.

Not published to npm yet. Inside the monorepo, depend on it with `"@bingoo.ai/explainer-web":
"workspace:*"`. It ships TypeScript source, and needs React 19 as a peer.

## Example

```tsx
'use client'
import { ExplainerPlayer } from '@bingoo.ai/explainer-web'
import '@bingoo.ai/explainer-web/styles.css'
import type { ExplainerDoc, LocaleBundle } from '@bingoo.ai/explainer'

export function Lesson({ doc, bundles }: { doc: ExplainerDoc; bundles: Record<string, LocaleBundle> }) {
  // `.exw` scopes the player stylesheet and maps its chrome onto your design tokens.
  return (
    <div className="exw">
      <ExplainerPlayer doc={doc} bundles={bundles} />
    </div>
  )
}
```

To draw one frame yourself — a thumbnail, a print sheet, a custom transport bar — skip the player and
render the model directly:

```tsx
import { Stage, defaultTheme } from '@bingoo.ai/explainer-web'
import { buildProgram, frame } from '@bingoo.ai/explainer'

const program = buildProgram(doc, bundles.vi!, '16:9')
const model = frame(program, 12.5) // seconds
;<Stage model={model} theme={defaultTheme} chrome={false} />
```

`usePlayer(doc, bundle, aspect)` is the same clock and gate state machine the player runs on, if you
want your own controls around it. `InteractiveManipulative` mounts a single manipulative kit as a
standalone sandbox. `ExplainerStudio` is the authoring editor (timeline, media panel, properties); it
reports edits through `onChange` and never persists anything itself.

## What it does not do

It does not decide what a frame contains. Document schema, layout, choreography, timing and linting
are `@bingoo.ai/explainer`; this package receives a `RenderModel` and paints it. If a scene is laid out
wrong, the bug is upstream.

It does not implement manipulatives. Geometry, verbs and answer checking live in
`@bingoo.ai/manipulatives` — `checkAnswer` is re-exported here only so a host can grade a preview
without adding the dependency. Quiz and answer widgets come from `@bingoo.ai/ui-web`.

It does not translate. `DEFAULT_QUIZ_LABELS` is an English fallback for embedded quiz beats, and
some player chrome is still hardcoded Vietnamese; routing those through `@bingoo.ai/i18n` is the host
app's job and remains unfinished.

It does not theme itself from your app. A lesson's theme is the document's own — cream paper stays
cream paper inside a dark admin shell. A lesson that should be dark says so in its own `ThemeTokens`.

It is not React Native. A native player would replace `Stage` with a Skia renderer and reuse the engine
unchanged.

## Purity

This package is deliberately impure: it holds a rAF clock, `<audio>` elements, speech synthesis,
pointer capture, and (in the studio) localStorage drafts. That is the point of the boundary — the
engine stays pure and testable because the effects are collected here.

## Licence

Apache-2.0 — see [../../LICENSE](../../LICENSE).

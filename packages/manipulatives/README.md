<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/manipulatives

67 teaching visuals — number line, base-10 blocks, fraction wall, balance scale, electric circuit,
essay map — as pure TypeScript that emits drawing primitives at any point in time.

Use it when you want a maths, English or science visual that moves and that a learner can drive, but
you do not want an animation library in your stack. A kit takes authored params, a list of verbs
(`jump`, `regroup`, `closeSwitch`, `partition`) and a time `t`, and returns `Prim[]` — lines, rects,
circles, paths, labels — positioned in whatever box you give it. You draw those with SVG, canvas,
Skia or anything else. Colours come back as token ids, so theming stays yours.

Motion is baked when the schedule is compiled, not simulated per frame. Rendering at t = 3.2s gives
the same output whether you scrubbed there or played there, which is what makes the same kit usable
in a recorded explainer, in a practice item, and in a sandbox where a learner drags a handle.

## Example

```ts
import { NumberLine, activeSegment, checkAnswer, compileManip } from '@bingoo.ai/manipulatives'

const state = compileManip(
  NumberLine,
  { min: 0, max: 10, step: 1 },
  [{ verb: 'jump', args: { a: 0, b: 7 } }],
  () => undefined, // cue name → scene time; no cues here, so verbs auto-sequence
)

const ctx = { aspect: '16:9', box: { w: 1280, h: 720 } } as const
const model = NumberLine.render(state.initial, state, 0.3, ctx)

model.prims.length // 26 primitives to draw, in the 1280×720 local box
activeSegment(state, 0.3).p // 0.5 — eased progress of the running jump
state.final.point // 7 — the logical answer, computed by code, not by pixels
checkAnswer('numberline', state.final, { point: 7 }) // true
```

`getManipulative(kind)` and `manipulativeKinds()` resolve kits by string, which is how you drive them
from authored JSON. `getInteractions(kind)` returns the direct-manipulation descriptor for 63 of them
— verb buttons, plus `onTap`/`onDrag` as pure functions of (params, local point, ctx). 21 kits declare
an answer contract via `kitAnswerDoc(kind)` (listed in `GRADABLE_KITS`), so you can generate a gradable
item and validate the target you generated. `KIT_DOCS` and `KIT_VERBS` are extracted from the source by
`pnpm verbdoc`: a description, every verb with its argument names, and the legal values of enum params
— enough to hand a model that has to author for kits it has never seen.

## What it does not do

**No rendering.** `Prim[]` is data. Nothing here touches the DOM, canvas, `requestAnimationFrame` or
SVG, and there is no React. The web renderer is `@bingoo.ai/ui-web`; the same primitives are meant to
feed a native one unchanged.

**No colours.** `color` and `fill` are token ids (`ink`, `accent`, `warn`, `paper` — see `TOK`), never
hex. Resolving them against a light or dark theme is the host's job.

**No timeline, narration or audio.** `compileManip` asks you for `markOf(cue)`; it does not own cue
marks. Scenes, voice and the beats verbs attach to live in `@bingoo.ai/explainer`.

**No grading policy.** `checkAnswer` answers one question: do these params match this target. Turning
that into evidence about a learner is `@bingoo.ai/telemetry` and `@bingoo.ai/knowledge-engine`.

**No layout.** `ctx.box` arrives already sized. Kits adapt to 16:9 and 9:16 within the box they are
handed; deciding that box is upstream.

**No translation.** The hints and button labels in `interactions.ts` are Vietnamese author-facing
strings; `kitDisplay(kind)` returns a `{ vi, en }` label and description for a picker. Text a learner
reads is supplied by the host.

## Purity

No clock, no randomness, no I/O. Every primitive is a function of `t` and the compiled state. Verbs
bake into 65-sample channel tables at compile time, so a frame costs a table lookup instead of a live
spring — and the sampler is plain-number data, safe to hand to a worklet.

`pnpm test:manip` drives all 67 kits through their real `render` at both aspects: registry integrity,
no NaN anywhere in the output, `render(t)` byte-identical when called twice, and value checks that the
maths is computed rather than drawn.

## Install

Not published to npm. Inside this monorepo, depend on it with `"@bingoo.ai/manipulatives":
"workspace:^"`. It exports TypeScript source directly — no build step, your bundler compiles it with
the rest of your app.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/learning-experience

Describe any learning session as five choices, then find out whether that combination makes sense and
what your app has to build to run it.

A tutoring app, a live quiz tournament, a scheduled classroom lesson and a scrollable practice feed are
usually four separate code paths that drift apart. Here they are four points in one space:
`experience × delivery × companion × scale × time`. The learner (or a config file, or a URL parameter)
picks some axes, `resolveDescriptor` fills in the rest, and you get back a verdict plus a list of
capabilities — `realtime`, `scheduling`, `roster`, `ai-tutor`, `matchmaking` — telling you which
subsystems this particular session needs mounted.

Reach for it when you support more than one way of learning and want the differences held as data
rather than as branches. Not every combination is coherent: "solo" with a human teacher is a
contradiction, and a discovery feed run as a scheduled class is legal but almost always a mistake. The
compatibility rules name both cases, with a stable rule id you can map to your own message. The engine
never quietly rewrites a choice — if the input is contradictory, the result says so and your UI decides
what to do about it.

## Example

```ts
import { deriveCapabilities, getBlueprint, resolveDescriptor } from '@bingoo.ai/learning-experience'

const r = resolveDescriptor({ experience: 'practice', companion: 'peer', scale: 'group' })
r.descriptor.delivery // 'async' — unset axes filled from DEFAULT_DESCRIPTOR
r.compatibility.verdict // 'VALID'
r.capabilities // ['practice-queue', 'human-presence', 'social-chat']
r.blueprint?.id // 'study-group' — this point has a preset recipe

const bad = resolveDescriptor({ scale: 'solo', companion: 'teacher' })
bad.descriptor.companion // 'teacher' — kept as chosen, not corrected
bad.compatibility.verdict // 'INVALID'
bad.compatibility.violations.map((v) => v.rule) // ['solo-needs-self-or-ai']

const classroom = getBlueprint('virtual-classroom')
if (classroom) deriveCapabilities(classroom.descriptor) // ['lesson-runtime', 'scheduling', 'roster', ...]
```

`resolveDescriptor` takes an optional second argument — the base to fill from — so a course can define
its own defaults instead of `DEFAULT_DESCRIPTOR`. `parseDescriptor` validates untrusted input (remote
config, query strings) and returns `undefined` rather than throwing. `descriptorKey` gives a
deterministic string for grouping and cache keys.

## Blueprints

`BLUEPRINTS` is seven named presets — `ai-tutor`, `daily-practice`, `live-arena`, `study-group`,
`virtual-classroom`, `mentor-session`, `feed-discovery` — each a descriptor plus a `labelKey`,
`accent` and lucide `icon` name. It is data, not logic: a new recipe is a new entry. Labels are keys,
not text; you map them to your own strings.

## What it does not do

- **No UI.** It renders nothing. `@bingoo.ai/ui-web` has the picker, card and shell components, and
  `@bingoo.ai/experiences` assembles the actual per-mode views on top of both.
- **No capabilities, only their names.** It tells you a session needs `realtime` or `matchmaking`. It
  does not open a WebSocket, pair opponents, or book a slot. Those are your app's.
- **No content.** A descriptor says how learning is organised, never what is taught. Lesson structure
  is `@bingoo.ai/plans`, items are `@bingoo.ai/authored-item`, generation is `@bingoo.ai/content-gen`.
- **No measurement.** Nothing here estimates mastery or records attempts. Evidence goes to
  `@bingoo.ai/telemetry` and `@bingoo.ai/knowledge-engine`.
- **No text.** Violation `reason` fields are developer-facing notes, not strings to show a learner.
  Translate from `rule` and `labelKey` yourself.
- **No scores.** Compatibility is `VALID`, `DISCOURAGED` or `INVALID` from explicit rules. No weights,
  no thresholds, no model.

## Purity

Pure TypeScript, `zod` the only dependency: no clock, no randomness, no I/O. The same descriptor
always yields the same verdict and the same capability list.

The package is `private` and not published to npm. Inside the monorepo, depend on it with
`"@bingoo.ai/learning-experience": "workspace:*"`; it exports `src/index.ts` directly, so there is no
build step.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

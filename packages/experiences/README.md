<!-- SPDX-FileCopyrightText: 2026 Bingoo.ai -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# @bingoo.ai/experiences

Ready-made React views for the six ways a learner meets your content: lesson, practice, arena,
feed, project, and live classroom.

You hand `LearnExperience` a descriptor (which of the six, and how it is delivered), your content,
and your display strings. It renders the whole surface — step navigation, progress and hearts HUD,
drill scoring, swipeable feed, arena match with health bars, project checklist, classroom stage with
roster and whiteboard. Swap `descriptor.experience` from `learn` to `arena` and the same content
bank becomes a battle; nothing else in your code changes.

Use it when you have lessons or question banks already and want the learner-facing screens without
building six of them. It is a view layer — no fetching, no routing, no persistence — and runs on the
client (React 19).

## Example

```tsx
import { LearnExperience, type ExperienceLabels } from '@bingoo.ai/experiences'

const labels: ExperienceLabels = buildLabels() // every visible string comes from you

export function LessonScreen() {
  return (
    <LearnExperience
      descriptor={{ experience: 'learn', delivery: 'async', companion: 'ai', scale: 'solo', time: 'on-demand' }}
      format="lesson"
      content={{ steps: [{ id: 's1', blocks: [{ type: 'paragraph', text: 'A number line is a ruler.' }] }] }}
      labels={labels}
      hud={{ xp: 620, streak: 5, hearts: { left: 4, max: 5 } }}
      onExit={() => router.back()}
    />
  )
}
```

`format` applies only to `experience: 'learn'` — `lesson` (paged, one step at a time), `course` (a
syllabus of lesson cards with a learning path), or `infinite` (an endless scroll of cards).
`delivery: 'classroom'` overrides the experience axis and renders the live classroom instead.

## Arena match engine

The arena battle runs on a pure, deterministic state machine you can also drive yourself — to score a
match on a server, replay one, or build your own arena view. Pass an `rng` for repeatable results.

```ts
import { initMatch, resolveRound, specialReady, useSpecial } from '@bingoo.ai/experiences'

let m = initMatch({ mode: 'coop', totalRounds: 10 })
m = resolveRound(m, { correct: true, timeMs: 2000 }, () => 0.99) // fast answer = bonus damage
if (specialReady(m)) m = useSpecial(m)
console.log(m.status, m.foe.hp, m.you.combo) // 'playing' | 'won' | 'lost'
```

## Content and labels

`ContentBlock[]` from `@bingoo.ai/core` describes each step's body — paragraphs, images, passages,
dialogue, vocabulary boxes, reading passages, discussion prompts. Interactive blocks (quiz,
flashcards, experiments) are handed back to you through `renderActivity`, so you choose what plays
them. A step can also carry a `node` you built yourself, which replaces its blocks entirely.

The package is i18n-free by design: `ExperienceLabels` is a required prop and holds every word the
learner reads, so translation stays in your app. Styling comes from `@bingoo.ai/ui-web` semantic
tokens, so add both packages' sources to your Tailwind `@source` globs and import
`@bingoo.ai/tokens/css`. Arena and feed sound effects are served by the host at `/sfx/{id}.mp3`;
without those files everything still works, silently.

## What it does not do

- No content. It renders steps, quiz items and courses you supply; it never generates or stores them.
  Authoring lives in `@bingoo.ai/authoring` and `@bingoo.ai/content-gen`.
- No grading beyond a right/wrong check for drills. Mastery, difficulty and evidence belong to
  `@bingoo.ai/knowledge-engine`, fed by `@bingoo.ai/telemetry`.
- No decision about which experience to show. That is `@bingoo.ai/learning-experience`, which builds
  and validates the descriptor from its five axes.
- No networking or persistence. Classroom video, chat transport, leaderboard data and progress
  saving are the host's job; the classroom view renders the stage, not the call.
- No translation, no design tokens of its own, no primitives. Strings come in as props, styles from
  `@bingoo.ai/ui-web` and `@bingoo.ai/tokens`.

## Installing

Not published to npm. Inside this monorepo, depend on it with `"@bingoo.ai/experiences":
"workspace:*"`; the package exports TypeScript source directly, so your app compiles it.

## Licence

Apache-2.0 — see [LICENSE](../../LICENSE).

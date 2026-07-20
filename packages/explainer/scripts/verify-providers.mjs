// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * verify-providers.mjs — headless checks that the explainer's provider LOGIC is
 * preserved after the move into bingoo: cue re-timing + illustration-first
 * resolveImage threshold behaviour, driven with fake ports (no vendor/env).
 *
 * Run: node --import ./scripts/ts-hook.mjs scripts/verify-providers.mjs
 */
import {
  cueMarksFrom,
  evenWords,
  charsToWords,
  cleanScript,
  resolveImage,
  SCORE_THRESHOLD,
} from '../src/providers/index'

let passed = 0,
  failed = 0
const fails = []
const ok = (name, cond, detail = '') => {
  if (cond) passed++
  else {
    failed++
    fails.push(`${name}${detail ? ' — ' + detail : ''}`)
  }
}

/* -------- cue re-timing: a cue lands on the START of its following word ------ */
{
  const script = 'One two [[cue:c1]] three four [[cue:c2]] five'
  const words = evenWords(cleanScript(script)) // One two three four five
  ok('cleanScript strips markers', cleanScript(script) === 'One two three four five')
  const marks = cueMarksFrom(script, words)
  ok('two cues', marks.length === 2, `got ${marks.length}`)
  // c1 precedes word index 2 ("three"); c2 precedes word index 4 ("five")
  ok(
    'c1 → word[2].start',
    marks[0].cue === 'c1' && Math.abs(marks[0].t - words[2].start) < 1e-6,
    JSON.stringify(marks[0]),
  )
  ok(
    'c2 → word[4].start',
    marks[1].cue === 'c2' && Math.abs(marks[1].t - words[4].start) < 1e-6,
    JSON.stringify(marks[1]),
  )
  // a trailing cue with no following word pins to the last word's end
  const trailing = cueMarksFrom('done [[cue:end]]', words.slice(0, 1))
  ok('trailing cue → lastEnd', trailing[0].t === +words[0].end.toFixed(2))
}

/* -------- charsToWords: alignment → words ----------------------------------- */
{
  const a = {
    characters: ['h', 'i', ' ', 'y', 'o'],
    character_start_times_seconds: [0.0, 0.1, 0.2, 0.3, 0.4],
    character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5],
  }
  const w = charsToWords(a)
  ok('charsToWords: 2 words', w.length === 2, `got ${w.length}`)
  ok("charsToWords: first word 'hi' 0.0–0.2", w[0].word === 'hi' && w[0].start === 0.0 && w[0].end === 0.2)
}

/* -------- resolveImage: illustration-first threshold ------------------------ */
const fakeSearch = (hits) => ({
  id: 'fake',
  available: () => true,
  async search() {
    return { items: hits, provider: 'fake' }
  },
})
const fakeImage = (url) => ({
  id: 'gen',
  available: () => true,
  async generate() {
    return { url, provider: 'gen' }
  },
})
{
  // confident library hit (≥ threshold) → library wins, no generation
  const r1 = await resolveImage(
    { prompt: 'a red apple', query: 'a red apple' },
    {
      search: fakeSearch([{ url: 'lib://apple.png', score: 0.9 }]),
      image: fakeImage('gen://apple.png'),
    },
  )
  ok('hit ≥ threshold → library', r1.source === 'library' && r1.url === 'lib://apple.png', JSON.stringify(r1))

  // weak hit (< threshold) → fall through to generation
  const weak = SCORE_THRESHOLD - 0.01
  const r2 = await resolveImage(
    { prompt: 'a red apple', query: 'a red apple' },
    {
      search: fakeSearch([{ url: 'lib://apple.png', score: weak }]),
      image: fakeImage('gen://apple.png'),
    },
  )
  ok(
    'hit < threshold → generated',
    r2.source === 'generated' && r2.url === 'gen://apple.png',
    JSON.stringify(r2),
  )

  // no search + generator available → generated
  const r3 = await resolveImage({ prompt: 'x', query: 'x' }, { image: fakeImage('gen://x.png') })
  ok('no search → generated', r3.source === 'generated')

  // no search, no generator → throws (caller leaves placeholder)
  let threw = false
  try {
    await resolveImage({ prompt: 'x', query: 'x' }, {})
  } catch {
    threw = true
  }
  ok('no library + no generator → throws', threw)
}

console.log(`\n${passed} passed · ${failed} failed`)
if (failed) {
  console.log('\nFAILURES:')
  for (const f of fails) console.log('  ✗ ' + f)
  process.exit(1)
}
console.log('✓ explainer provider logic preserved — cue re-timing + illustration-first threshold')

/**
 * verify-acceptance.mjs — validate the fresh acceptance lesson (authored for the
 * bingoo migration, NOT ported demo content) against the real engine: parseDoc +
 * parseBundle + lintDoc (0 errors) + buildProgram + frame at several t (finite,
 * non-empty). Proves an authored ExplainerDoc plays before it is wired into apps.
 *
 * Run: node --import ./scripts/ts-hook.mjs scripts/verify-acceptance.mjs
 */
import { parseDoc, parseBundle, lintDoc, buildProgram, frame } from '../src/index'
import { ACCEPTANCE_DOC, ACCEPTANCE_VI, ACCEPTANCE_EN } from '../../../apps/web/src/lib/explainerLesson'

let failed = 0
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!cond) failed++
}

const doc = parseDoc(ACCEPTANCE_DOC)
const vi = parseBundle(ACCEPTANCE_VI)
const en = parseBundle(ACCEPTANCE_EN)
ok('parseDoc + parseBundle(vi,en)', true)

const errs = lintDoc(doc, [vi, en]).filter((i) => i.level === 'error')
ok('lint: 0 errors', errs.length === 0, errs.map((e) => `${e.code}:${e.message}`).join(' | '))

for (const [name, bundle] of [
  ['vi', vi],
  ['en', en],
]) {
  for (const aspect of ['16:9', '9:16']) {
    const program = buildProgram(doc, bundle, aspect)
    let bad = 0,
      empty = 0
    for (const t of [0, program.duration * 0.5, program.duration]) {
      const m = frame(program, t)
      if (!m || !Array.isArray(m.items)) bad++
      if ((m.items?.length ?? 0) === 0) empty++
    }
    ok(`${name} @${aspect}: builds+renders (dur ${program.duration.toFixed(1)}s)`, bad === 0 && empty < 3)
  }
}

console.log(
  failed
    ? `\n${failed} FAILED`
    : '\n✓ acceptance lesson valid — lint-clean, builds, renders vi+en × 16:9+9:16',
)
if (failed) process.exit(1)

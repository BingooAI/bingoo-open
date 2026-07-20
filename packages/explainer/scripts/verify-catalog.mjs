/**
 * verify-catalog.mjs — the authoring contract must stay TRUE.
 *
 * The catalog is derived from the layout engine, so the danger is not that it
 * goes stale (the compiler prevents that) but that it becomes WRONG: a budget
 * that claims 40 characters fit when the renderer would shrink them below the
 * legibility floor. This asserts the contract against the engine, and asserts
 * that the gate actually catches the scenes a careless generator produces.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  authoringGuide,
  promptMarkdown,
  checkScene,
  templateCatalog,
  contractOf,
  TEMPLATES,
  SLOT_META,
} from '../src/index.ts'
import { EXAMPLES } from '../src/examples.ts'
import { REFERENCE_DOC, REFERENCE_BUNDLE } from '../src/reference.ts'
import { checkLesson, lintDoc, parseDoc, parseBundle, quizDocs, quizGuide } from '../src/index.ts'
import { QUIZ_TYPES } from '@bingoo/core'

let failed = 0
const ok = (cond, msg) => {
  if (!cond) {
    console.error('  ✗', msg)
    failed++
  }
}

const cat = templateCatalog()
ok(cat.length >= 20, 'catalog should cover every non-legacy template')
for (const t of cat) {
  ok(t.slots.length > 0, `${t.template}: no slots`)
  ok(!!t.use, `${t.template}: no "use" — a generator cannot choose it`)
  for (const s of t.slots) {
    ok(s.min <= s.max, `${t.template}.${s.name}: min > max`)
    ok(!!s.role, `${t.template}.${s.name}: no role`)
    // every text slot MUST carry a measured budget, else the model gets
    // "keep it short", which it ignores
    if (s.accepts.includes('text') && s.max > 0)
      ok(typeof s.maxChars === 'number' && s.maxChars > 5, `${t.template}.${s.name}: no measured char budget`)
  }
}

// A scene an LLM would plausibly produce if it only read a prose prompt.
const bad = {
  id: 'x',
  kind: 'exposition',
  layout: { template: 'teach', regions: {} },
  elements: [
    { id: 'ti', type: 'text', region: 'title', content: {} },
    { id: 'im', type: 'image', region: 'hero', content: {} }, // slot không tồn tại
    { id: 'tx', type: 'text', region: 'stage', content: {} }, // sai type cho slot
    { id: 'dc', type: 'image', region: 'decor', content: {} }, // slot đã bị xoá
  ],
}
const strings = {
  ti: 'Hôm nay chúng ta sẽ cùng nhau tìm hiểu thật kỹ về số chẵn và số lẻ trong toán học lớp một',
}
const found = checkScene(bad, strings)
  .filter((f) => f.level === 'error')
  .map((f) => f.code)
for (const code of ['unknown-slot', 'wrong-type', 'over-budget'])
  ok(found.includes(code), `gate missed "${code}" on a deliberately-bad scene`)
for (const f of checkScene(bad, strings)) ok(!!f.fix, `finding "${f.code}" has no actionable fix`)

// a scene that PASSES must lay out cleanly at both aspects — that is the promise
const good = {
  id: 'g',
  kind: 'exposition',
  layout: { template: 'bullets', regions: {} },
  elements: [
    { id: 'h', type: 'text', region: 'title', style: { fontSize: 'title' }, content: {} },
    {
      id: 'b',
      type: 'list',
      region: 'list',
      content: { style: 'number', items: ['Đếm', 'Ghép đôi', 'Kết luận'] },
    },
  ],
}
ok(
  checkScene(good, { h: 'Số chẵn & số lẻ' }).filter((f) => f.level === 'error').length === 0,
  'a valid scene was rejected',
)

ok(authoringGuide().includes('maxChars'), 'the guide must quote measured budgets')
ok(authoringGuide().includes('bullets'), 'the guide must be generated from the catalog')
ok(!contractOf('hero-caption'), 'LEGACY templates must not be offered to a generator')

// EVERY non-legacy template needs a worked example — one without is a template
// the model will guess at, and guessing is what the whole contract exists to stop.
for (const t of TEMPLATES) {
  if (SLOT_META[t].use.startsWith('LEGACY')) continue
  ok(!!EXAMPLES[t], `template "${t}" has no worked example — the model will guess`)
}

// Every example must PASS the gate. A stale few-shot is worse than none: it
// teaches the model to produce exactly the scene the gate will then reject.
for (const [tpl, ex] of Object.entries(EXAMPLES)) {
  const errs = checkScene(ex.scene, ex.strings).filter((f) => f.level === 'error')
  ok(errs.length === 0, `example "${tpl}" fails the gate: ${errs.map((e) => e.code).join(', ')}`)
  ok(!!ex.why, `example "${tpl}" has no "why" — it teaches filling but not SELECTION`)
}

// The emitted artifacts must MATCH the engine. If someone moves a slot and
// forgets `pnpm contract`, the LLM would be handed a stale map — fail here.
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'contract')
try {
  const md = readFileSync(join(dir, 'AUTHORING.md'), 'utf8')
  ok(
    md.includes(authoringGuide()),
    'contract/AUTHORING.md is STALE — run `pnpm --filter @bingoo/explainer contract`',
  )
  const cat = JSON.parse(readFileSync(join(dir, 'catalog.json'), 'utf8'))
  ok(
    JSON.stringify(cat.templates) === JSON.stringify(templateCatalog()),
    'contract/catalog.json is STALE — run `pnpm --filter @bingoo/explainer contract`',
  )
  // PROMPT.md must be BYTE-IDENTICAL to what promptMarkdown() builds — that is
  // the same function the admin download button calls, so a drift here means a
  // teacher could be handed a brief describing an engine that no longer exists.
  const prompt = readFileSync(join(dir, 'PROMPT.md'), 'utf8')
  ok(
    prompt === promptMarkdown(),
    'contract/PROMPT.md is STALE — run `pnpm --filter @bingoo/explainer prompt`',
  )
} catch (e) {
  if (e.code === 'ENOENT')
    ok(false, 'contract/ not generated — run `pnpm --filter @bingoo/explainer contract`')
  else throw e
}

// The GOLD LESSON must pass every gate it teaches the model to satisfy. A gold
// example the gate would reject is worse than none: it teaches the model to
// produce exactly the lesson that then gets thrown away.
{
  const doc = parseDoc(REFERENCE_DOC),
    bundle = parseBundle(REFERENCE_BUNDLE)
  const gold = [
    ...lintDoc(doc, [bundle]),
    ...checkLesson(doc, bundle),
    ...doc.scenes.flatMap((s) => checkScene(s, bundle.strings, bundle.locale)),
  ].filter((f) => f.level === 'error')
  ok(gold.length === 0, `REFERENCE lesson fails its own gate: ${gold.map((f) => f.code).join(', ')}`)
  ok(doc.scenes.length >= 12, 'REFERENCE lesson is too short to model a real lesson')
}

// Every question type must be DOCUMENTED, not just named. Listing "venn" tells a
// model nothing; it cannot invent `labelA`, `items` and `assignment` from a word,
// so it falls back to `single` forever and 54 types go unused.
{
  const docs = quizDocs()
  ok(
    docs.length === QUIZ_TYPES.length,
    `quizDocs covers ${docs.length} of ${QUIZ_TYPES.length} question types`,
  )
  for (const d of docs) {
    // every type except `boolean`-likes carries payload fields; a type with none
    // documented means the introspection broke, not that the type is field-free
    ok(d.fields.length > 0, `question type "${d.type}" has no documented fields`)
    for (const f of d.fields) ok(!!f.type && f.type !== 'any', `${d.type}.${f.name}: field type not resolved`)
  }
  const g = quizGuide()
  for (const t of QUIZ_TYPES) ok(g.includes(`\`${t}\``), `the brief never documents question type "${t}"`)
}

if (failed) {
  console.error(`\n✗ ${failed} contract assertion(s) failed`)
  process.exit(1)
}
console.log(
  `✓ authoring contract holds — ${cat.length} templates · ${cat.reduce((n, t) => n + t.slots.length, 0)} slots · ${quizDocs().length} loại câu hỏi có shape · ${Object.keys(EXAMPLES).length} ví dụ qua gate · contract/ khớp engine`,
)

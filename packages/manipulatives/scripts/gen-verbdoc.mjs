/**
 * gen-verbdoc.mjs — extract each kit's VERB SIGNATURES from its source header.
 *
 * The registry exposes verb NAMES (`Object.keys(kit.verbs)`) but not their args,
 * because the args are just `(p, args)` at the type level. The signatures do
 * exist — every kit's file header documents them:
 *
 *     verbs: setNumber(n) · add(n) · remove(n) · showResult.
 *
 * …but only a human reading the source could see them. So a model handed the
 * registry knew a kit could `setNumber` and had no idea it takes `{n}`. It
 * therefore wrote kits with no actions at all — which is why generated lessons
 * came out as slide decks with a picture where a manipulative should have been.
 *
 * This lifts those lines into `verbs.json`, which the authoring prompt embeds.
 * Derived from the source, so it cannot describe a verb that was renamed.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'contract')
mkdirSync(OUT, { recursive: true })

const SKIP = new Set([
  'types.ts',
  'bake.ts',
  'util.ts',
  'index.ts',
  'registry.ts',
  'icons.ts',
  'easing.ts',
  'interactions.ts',
])

/** Enum types SHARED across kits (icons.ts etc.) — a kit's `icon: IconShape` is
 *  declared in another file, so a per-file scan would miss every one of them. */
const SHARED = {}
for (const f of ['icons.ts', 'types.ts', 'util.ts']) {
  let src
  try {
    src = readFileSync(join(SRC, f), 'utf8')
  } catch {
    continue
  }
  for (const m of src.matchAll(
    /^export type (\w+) =\s*((?:"[\w-]+"\s*\|\s*)+(?:"[\w-]+"|\(string & \{\}\)))/gm,
  )) {
    SHARED[m[1]] = [...m[2].matchAll(/"([\w-]+)"/g)].map((x) => x[1])
  }
}

const out = {}
const missing = []

for (const f of readdirSync(SRC).filter((f) => f.endsWith('.ts') && !SKIP.has(f))) {
  const src = readFileSync(join(SRC, f), 'utf8')

  // the kit's registered `kind` — the id a lesson actually writes
  const kind = src.match(/kind:\s*["']([\w-]+)["']/)?.[1]
  if (!kind) continue

  // WHAT THE KIT IS, and when to reach for it. Without this a model handed 67
  // kinds has no way to choose between them — it picks the first one whose name
  // it recognises and uses it four times. The description already exists: every
  // kit's file header opens with one, written by whoever built it. Nobody had
  // ever lifted it out of the source.
  const header = src.match(/^\/\*\*([\s\S]*?)\*\//)?.[1] ?? ''
  const desc = header
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trim())
    .join(' ')
    .trim()
    .replace(/^[\w.-]+\.ts\s*[—–-]\s*/, '') // strip the "tenframe.ts — " prefix
    .split(/\bverbs?:/i)[0] // the verb list is emitted separately
    .replace(/\s*\(kit #\d+[^)]*\)/i, '') // internal bookkeeping, not for a model
    .replace(/\s*params:\s*\{[\s\S]*$/, '') // params are emitted separately
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)

  // Read the ARGS OUT OF THE CODE, not out of a comment. A header line saying
  // `setNumber(n)` is prose that rots the day someone renames the arg; the verb
  // body's `args?.n` is the truth, and it is what the model must actually pass.
  // Kits write verbs both as one-liners and as blocks, so anchor on the verb
  // HEADERS and take each body as the text up to the next header (or the end of
  // the verbs object). Matching a closing brace fails on one-liners, and did:
  // it swallowed every verb of `evenodd` into the first one.
  const heads = [...src.matchAll(/^ {2}(\w+)\(p(?:,\s*args)?\)[^{]*\{/gm)]
  const verbs = heads.map((h, i) => {
    const start = h.index + h[0].length
    const end = i + 1 < heads.length ? heads[i + 1].index : src.indexOf('\n};', start)
    const body = src.slice(start, end < 0 ? undefined : end)
    const args = [...new Set([...body.matchAll(/args\?\.(\w+)/g)].map((a) => a[1]))]
    return { name: h[1], args }
  })
  if (!verbs.length) missing.push(kind)

  // LEGAL VALUES for enum params. `defaultParams` shows ONE value ("apple"), so a
  // model has no way to learn that "star" and "heart" exist — it must guess, and
  // a guess that misses renders the wrong object with NO error, because kit params
  // are `unknown` and nothing validates them.
  const enums = { ...SHARED }
  for (const m of src.matchAll(
    /^export type (\w+) =\s*((?:"[\w-]+"\s*\|\s*)+(?:"[\w-]+"|\(string & \{\}\)))/gm,
  )) {
    enums[m[1]] = [...m[2].matchAll(/"([\w-]+)"/g)].map((x) => x[1])
  }
  // map each param key to its enum, via the kit's params type (`shape: CountShape`)
  const paramEnums = {}
  for (const m of src.matchAll(/^\s{2}(\w+)\??:\s*(\w+);/gm)) {
    if (enums[m[2]]) paramEnums[m[1]] = enums[m[2]]
  }
  // Most kits type their icon param as a bare `string` and then hand it to
  // `drawIcon`, which only understands IconShape. The TYPE therefore says nothing,
  // but the CALL does: if the kit draws icons, its `icon` param is an IconShape.
  if (/from "\.\/icons"/.test(src) && /^\s{2}icon\??:\s*string;/m.test(src) && SHARED.IconShape) {
    paramEnums.icon = SHARED.IconShape
  }

  out[kind] = {
    desc,
    ...(Object.keys(paramEnums).length ? { paramEnums } : {}),
    signatures: verbs.map((v) => (v.args.length ? `${v.name}({${v.args.join(',')}})` : v.name)).join(' · '),
    verbs,
  }
}

writeFileSync(
  join(OUT, 'verbs.json'),
  JSON.stringify(
    {
      $comment:
        "GENERATED from each kit's source header by scripts/gen-verbdoc.mjs. `signatures` carries the ARG names — a model cannot call setNumber without knowing it takes {n}.",
      kits: out,
    },
    null,
    2,
  ),
)

const n = Object.keys(out).length
console.log(`✓ contract/verbs.json — ${n} kit`)
if (missing.length)
  console.log(`  ⚠ ${missing.length} kit chưa có dòng "verbs:" ở header: ${missing.join(', ')}`)

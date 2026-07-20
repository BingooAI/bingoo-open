/**
 * Prompt-management self-test (no LLM calls). Verifies interpolation + the
 * runtime override roundtrip (default → override → revert) via RemoteConfig.
 * Run: `node --env-file=.env --import tsx src/scripts/prompt-check.ts`
 */
import { db } from '@bingoo.ai/db'
import {
  clearPromptOverride,
  getPromptTemplate,
  interpolate,
  listPromptViews,
  renderPrompt,
  setPromptOverride,
  PROMPTS,
} from '../prompts'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

async function main() {
  check('interpolate replaces vars + tidies spaces', interpolate('a {{x}}  {{y}} b', { x: 'Z' }) === 'a Z b')

  const id = 'media.nl.parse' as const
  await clearPromptOverride(id) // ensure clean start

  check('default template resolves from catalog', (await getPromptTemplate(id)) === PROMPTS[id].template)

  await setPromptOverride(id, 'OVERRIDE {{q}}', 'user_prompt_test')
  check(
    'override takes effect at runtime (no release)',
    (await renderPrompt(id, { q: 'hi' })) === 'OVERRIDE hi',
  )
  const views = await listPromptViews()
  check('listPromptViews marks it overridden', views.find((v) => v.id === id)?.overridden === true)

  await clearPromptOverride(id)
  check('clearing reverts to the in-code default', (await getPromptTemplate(id)) === PROMPTS[id].template)
  const views2 = await listPromptViews()
  check(
    'all prompts overridden=false after revert',
    views2.every((v) => !v.overridden),
  )

  console.log(`\n${fail === 0 ? '🎉' : '⚠️ '} ${pass} passed, ${fail} failed (${listCount(views2)})`)
  await db.$disconnect()
  process.exit(fail === 0 ? 0 : 1)
}

function listCount(views: { id: string }[]): string {
  return `${views.length} prompts in catalog`
}

main().catch(async (err) => {
  console.error('prompt check crashed:', err)
  await db.$disconnect()
  process.exit(1)
})

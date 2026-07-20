// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * verify-sfx-search.ts — proves the uploaded SFX are findable by NLP/semantic
 * search. Runs real hybrid (semantic + lexical, RRF) queries against the media
 * library as an anonymous user (APPROVED + PUBLIC only) and maps the returned
 * asset ids back to sfx ids via the manifest.
 *
 * Run from apps/api:
 *   node --env-file=.env --import tsx src/scripts/verify-sfx-search.ts
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@bingoo.ai/db'
import { getSearch } from '../providers'
import { buildMediaSubject, toSearchFilter } from '../repos/media-access.repo'

const MANIFEST = path.join(process.cwd(), '../..', 'apps/mobile/src/sfx-manifest.json')

const QUERIES: { q: string; expect: RegExp }[] = [
  { q: 'tiếng con mèo kêu meo meo', expect: /^animal_cat$/ },
  { q: 'tiếng chó sủa', expect: /^animal_dog$/ },
  {
    q: 'âm thanh chúc mừng khi thắng, phần thưởng',
    expect: /^(celebrate|level_up|achievement|coin|star|treasure|daily_reward)$/,
  },
  {
    q: 'a happy reward chime for winning',
    expect: /^(level_up|celebrate|achievement|coin|star|treasure|xp_gain)$/,
  },
  { q: 'âm báo khi trả lời sai', expect: /^(incorrect|error_soft|warning_soft|drop_fail)$/ },
  {
    q: 'ocean wave and water sound',
    expect: /^(ocean_wave|splash|river|water_tap|shower|rain_light|rain_heavy)$/,
  },
  {
    q: 'tiếng chuông thông báo tin nhắn',
    expect: /^(chat_message|ding|phone_ring|school_bell|notify)$/,
  },
]

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8')) as Record<string, { key: string }>
  const sfxByAsset = new Map<string, string>()
  for (const [sfx, e] of Object.entries(manifest)) {
    const m = e.key.match(/global\/global\/([^/]+)\//)
    if (m) sfxByAsset.set(m[1]!, sfx)
  }

  const anon = await buildMediaSubject(null)
  const filter = toSearchFilter(anon)
  let pass = 0

  for (const { q, expect } of QUERIES) {
    const res = await getSearch().query({ text: q, mode: 'hybrid' }, filter)
    const top = res.hits.slice(0, 5).map((h) => sfxByAsset.get(h.assetId) ?? h.assetId.slice(0, 8))
    const rank = top.findIndex((x) => expect.test(x))
    const ok = rank >= 0
    if (ok) pass++
    console.log(
      `${ok ? '✅' : '⚠️ '} "${q}"\n     → [${top.join(', ')}]  ${ok ? `match #${rank + 1}` : `expected ${expect}`}\n`,
    )
  }
  console.log(`${pass}/${QUERIES.length} semantic queries hit the expected SFX.`)
  await db.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await db.$disconnect()
  process.exit(1)
})

// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * AI media-generation self-test. Hits live OpenAI (image) + ElevenLabs (TTS),
 * lands the results as PENDING library assets in R2, verifies them, cleans up.
 * Run: `node --env-file=.env --import tsx src/scripts/media-generate-check.ts`
 * (costs a little image + TTS credit).
 */
import { db } from '@bingoo.ai/db'
import { getStorage } from '../providers'
import { deleteAsset, getAssetById, listRenditions } from '../repos/media-asset.repo'
import { generateAudioAsset, generateImageAssets } from '../services/media-generate.service'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

async function r2Exists(assetId: string): Promise<boolean> {
  const rends = await listRenditions(assetId)
  const original = rends.find((r) => r.kind === 'ORIGINAL')
  if (!original?.storageKey) return false
  const { url } = await getStorage(original.provider ?? undefined).createSignedDownloadUrl({
    key: original.storageKey,
  })
  const res = await fetch(url)
  return res.ok && Number(res.headers.get('content-length')) > 0
}

async function cleanup(assetId: string) {
  for (const r of await listRenditions(assetId)) {
    if (r.storageKey)
      await getStorage(r.provider ?? undefined)
        .deleteObject(r.storageKey)
        .catch(() => {})
  }
  await deleteAsset(assetId).catch(() => {})
}

async function main() {
  // ── Image via OpenAI ───────────────────────────────────────────────────────
  console.log('Generating image via OpenAI…')
  const images = await generateImageAssets({
    prompt: 'a simple flat illustration of a red apple on a white background, for kids',
    count: 1,
    visibility: 'PRIVATE',
    createdById: 'user_gen_test',
  })
  check('image generation returns 1 asset', images.length === 1, `got ${images.length}`)
  if (images[0]) {
    const a = await getAssetById(images[0].id)
    check(
      'image asset is IMAGE + PENDING (R5 gate)',
      a?.kind === 'IMAGE' && a?.moderation === 'PENDING',
      `${a?.kind}/${a?.moderation}`,
    )
    check(
      'image asset flagged aiGenerated in metadata',
      Boolean((a?.metadata as { aiGenerated?: boolean })?.aiGenerated),
    )
    check('image bytes stored + downloadable from R2', await r2Exists(images[0].id))
    await cleanup(images[0].id)
  }

  // ── Audio via ElevenLabs ─────────────────────────────────────────────────────
  console.log('Generating audio via ElevenLabs…')
  const audio = await generateAudioAsset({
    text: 'Xin chào các bạn, hôm nay chúng ta học về hình tam giác.',
    languageCode: 'vi',
    visibility: 'PRIVATE',
    createdById: 'user_gen_test',
  })
  const au = await getAssetById(audio.id)
  check(
    'audio asset is AUDIO + PENDING',
    au?.kind === 'AUDIO' && au?.moderation === 'PENDING',
    `${au?.kind}/${au?.moderation}`,
  )
  check(
    'audio provider recorded = elevenlabs',
    (au?.metadata as { generator?: { provider?: string } })?.generator?.provider === 'elevenlabs',
  )
  check('audio bytes stored + downloadable from R2', await r2Exists(audio.id))
  await cleanup(audio.id)

  console.log(`\n${fail === 0 ? '🎉' : '⚠️ '} ${pass} passed, ${fail} failed`)
  await db.$disconnect()
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error('generation check crashed:', err)
  await db.$disconnect()
  process.exit(1)
})

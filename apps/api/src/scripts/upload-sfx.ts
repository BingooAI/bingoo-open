/**
 * upload-sfx.ts — publish the DevUP sound-effect pack into Bingoo's media library
 * (R2 + MediaAsset records), so the app plays SFX from OUR storage — moderated,
 * permissioned, and searchable. Each asset gets a bilingual title + description
 * and tags, then an embedding (media-enrich) so NLP/semantic search finds it
 * later ("tiếng mèo", "reward chime", "âm báo sai"). Curated pack → APPROVED,
 * GLOBAL, PUBLIC. Idempotent: a manifest tracks what's uploaded, so re-runs skip.
 *
 * Run from apps/api:
 *   node --env-file=.env --import tsx src/scripts/upload-sfx.ts
 *   SFX_LIMIT=1 node --env-file=.env --import tsx src/scripts/upload-sfx.ts   # smoke test
 *
 * Writes apps/mobile/src/sfx-manifest.json → { [id]: { publicId, key, url } }.
 */
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@bingoo.ai/db'
import { getStorage } from '../providers'
import { renditionStorageKey } from '../lib/media-serialize'
import {
  completeAsset,
  createAsset,
  getAssetByPublicId,
  putRendition,
  setAssetStatus,
} from '../repos/media-asset.repo'
import { addAssetTags, upsertTag } from '../repos/media-tag.repo'
import { enrichAsset } from '../services/media-enrich.service'
import { sfxMeta, type TagSpec } from './sfx-meta'

const REPO = path.resolve(process.cwd(), '../..')
const SFX_DIR = path.join(REPO, 'apps/web/public/sfx')
const MANIFEST = path.join(REPO, 'apps/mobile/src/sfx-manifest.json')
const LIMIT = Number(process.env.SFX_LIMIT) || Number.POSITIVE_INFINITY

type Entry = { publicId: string; key: string; url: string | null }

async function loadManifest(): Promise<Record<string, Entry>> {
  try {
    return JSON.parse(await readFile(MANIFEST, 'utf8')) as Record<string, Entry>
  } catch {
    return {}
  }
}

async function main() {
  const storage = getStorage()
  const files = (await readdir(SFX_DIR)).filter((f) => f.endsWith('.mp3')).sort()
  const manifest = await loadManifest()
  const tagCache = new Map<string, string>() // slug → tagId (tags are shared across assets)
  let uploaded = 0
  let skipped = 0
  let embedded = 0

  const tagId = async (ts: TagSpec): Promise<string> => {
    const hit = tagCache.get(ts.slug)
    if (hit) return hit
    const tag = await upsertTag({ slug: ts.slug, kind: ts.kind, label: { vi: ts.vi, en: ts.en } })
    tagCache.set(ts.slug, tag.id)
    return tag.id
  }

  for (const file of files) {
    if (uploaded + skipped >= LIMIT) break
    const id = file.replace(/\.mp3$/, '')

    // Idempotency: already uploaded AND still present in the library → skip.
    const known = manifest[id]
    if (known) {
      const existing = await getAssetByPublicId(known.publicId)
      if (existing) {
        skipped++
        continue
      }
    }

    const meta = sfxMeta(id)
    const bytes = await readFile(path.join(SFX_DIR, file))
    const checksum = createHash('sha256').update(bytes).digest('hex')

    const asset = await createAsset({
      kind: 'AUDIO',
      title: meta.title,
      description: meta.description,
      scope: 'GLOBAL',
      visibility: 'PUBLIC',
      moderation: 'APPROVED',
      mimeType: 'audio/mpeg',
      source: 'devup-sfx',
      license: 'DevUP',
    })

    const key = renditionStorageKey('GLOBAL', null, asset.id, 'original', 'mp3')
    await storage.putObject({
      key,
      body: bytes,
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000, immutable',
    })
    await putRendition(asset.id, {
      kind: 'ORIGINAL',
      storageKey: key,
      mimeType: 'audio/mpeg',
      byteSize: bytes.byteLength,
      checksum,
    })
    await completeAsset(asset.id, { byteSize: bytes.byteLength, checksum })
    await setAssetStatus(asset.id, 'READY')

    // Tags → then an embedding (embedOnly: skip the slow LLM, keep NLP search).
    const tagIds = await Promise.all(meta.tags.map(tagId))
    await addAssetTags({ assetId: asset.id, tagIds, source: 'IMPORT' })
    const enr = await enrichAsset(asset.id, { embedOnly: true })
    if (enr.embedded) embedded++

    const url = storage.getPublicUrl(key)
    manifest[id] = { publicId: asset.publicId, key, url }
    uploaded++
    console.log(`✅ ${id.padEnd(22)} ${enr.embedded ? '🔎' : '  '} → ${url ?? key}`)
  }

  const sorted = Object.fromEntries(
    Object.keys(manifest)
      .sort()
      .map((k) => [k, manifest[k]]),
  )
  await writeFile(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(
    `\nUploaded ${uploaded}, embedded ${embedded}, skipped ${skipped}. Manifest holds ${Object.keys(manifest).length} SFX.`,
  )
  await db.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await db.$disconnect()
  process.exit(1)
})

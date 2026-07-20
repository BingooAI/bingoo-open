/**
 * Media library end-to-end self-test (CLAUDE.md §0.5). Exercises the real stack:
 * Neon Postgres (tree, tsvector trigger, GIN, HNSW), R2 (signed upload/download),
 * OpenAI (embeddings + AI suggestion), permission resolution, hybrid search — in
 * both vi and en. Run: `node --env-file=.env --import tsx src/scripts/media-e2e.ts`
 * Creates then deletes its fixtures.
 */
import { db } from '@bingoo/db'
import { getSearch, getStorage } from '../providers'
import {
  buildMediaSubject,
  resolveAssetPermission,
  toSearchFilter,
  addGrant,
} from '../repos/media-access.repo'
import {
  completeAsset,
  createAsset,
  deleteAsset,
  getAssetById,
  putRendition,
  setAssetModeration,
  setAssetStatus,
  updateAsset,
} from '../repos/media-asset.repo'
import { resolveServiceToken } from '../lib/service-token'
import { createFolder, getFolderTree } from '../repos/media-folder.repo'
import { addAssetTags, getTagBySlug, relateTags, upsertTag } from '../repos/media-tag.repo'
import { renditionStorageKey } from '../lib/media-serialize'
import { enrichAsset } from '../services/media-enrich.service'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

async function main() {
  const cleanup: { assets: string[]; folders: string[] } = { assets: [], folders: [] }

  // ── Tree (materialised path) ───────────────────────────────────────────────
  const root = await createFolder({
    name: { vi: 'Thư viện Toán', en: 'Math Library' },
    scope: 'GLOBAL',
    visibility: 'PUBLIC',
  })
  const sub = await createFolder({ name: { vi: 'Hình học', en: 'Geometry' }, parentId: root.id })
  cleanup.folders.push(sub.id, root.id)
  check(
    'folder path is materialised',
    sub.path.startsWith(root.path) && sub.path.endsWith(`${sub.id}.`),
    sub.path,
  )
  const tree = await getFolderTree(root.id)
  check('subtree query returns 2 folders', tree.length === 2, `got ${tree.length}`)
  check('child inherits parent scope', sub.scope === 'GLOBAL')

  // ── Taxonomy (facet + ALIAS recall) ────────────────────────────────────────
  const math = await upsertTag({
    slug: 'math',
    kind: 'SUBJECT',
    label: { vi: 'Toán', en: 'Math' },
  })
  const geo = await upsertTag({
    slug: 'geometry',
    kind: 'TOPIC',
    label: { vi: 'Hình học', en: 'Geometry' },
    parentId: math.id,
  })
  const alias = await upsertTag({
    slug: 'hinh-hoc',
    kind: 'TOPIC',
    label: { vi: 'hình học', en: 'shapes' },
  })
  await relateTags(alias.id, geo.id, 'ALIAS')
  check('tag slug normalised from diacritics', (await getTagBySlug('hinh-hoc')) !== null)
  check('child tag path under parent', geo.path.startsWith(math.path))

  // ── Asset + keyword projection ─────────────────────────────────────────────
  const asset = await createAsset({
    kind: 'IMAGE',
    title: { vi: 'Tam giác đều', en: 'Equilateral triangle' },
    description: {
      vi: 'Hình tam giác ba cạnh bằng nhau cho bài học hình học',
      en: 'A three equal-sided triangle for a geometry lesson',
    },
    folderId: sub.id,
    visibility: 'PUBLIC',
    mimeType: 'image/png',
    ownerId: 'user_owner_test',
    createdById: 'user_owner_test',
  })
  cleanup.assets.push(asset.id)
  check('asset minted publicId', asset.publicId.startsWith('BG'))
  check('asset inherited folder scope', asset.scope === 'GLOBAL')

  const keywords = await addAssetTags({ assetId: asset.id, tagIds: [geo.id], source: 'MANUAL' })
  check(
    'keyword projection includes ancestor (math via geometry)',
    keywords.includes('math') && keywords.includes('geometry'),
    keywords.join(','),
  )

  // ── R2 signed upload + download (real bytes) ───────────────────────────────
  const key = renditionStorageKey(asset.scope, asset.scopeId, asset.id, 'original', 'png')
  const storage = getStorage()
  const { url: putUrl } = await storage.createSignedUploadUrl({ key, contentType: 'image/png' })
  const body = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex') // tiny PNG header bytes
  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body,
  })
  check('R2 signed PUT upload', putRes.ok, `status ${putRes.status}`)
  await putRendition(asset.id, {
    kind: 'ORIGINAL',
    provider: 'r2',
    storageKey: key,
    mimeType: 'image/png',
    byteSize: body.length,
  })
  const { url: getUrl } = await storage.createSignedDownloadUrl({ key })
  const getRes = await fetch(getUrl)
  check('R2 signed GET download', getRes.ok, `status ${getRes.status}`)

  await completeAsset(asset.id, { byteSize: body.length, checksum: 'testsha' })

  // ── Permission resolution (before moderation) ──────────────────────────────
  const anon = await buildMediaSubject(null)
  const permAnonPending = await resolveAssetPermission(anon, asset.id, {
    ownerId: asset.ownerId,
    visibility: 'PUBLIC',
    moderation: 'PENDING',
    status: 'PROCESSING',
    scope: 'GLOBAL',
    scopeId: null,
    folderId: sub.id,
  })
  check(
    'anon cannot see PUBLIC-but-unmoderated asset (R5)',
    permAnonPending === null,
    String(permAnonPending),
  )

  const owner = await buildMediaSubject({ id: 'user_owner_test', role: 'USER' } as never)
  const permOwner = await resolveAssetPermission(owner, asset.id, {
    ownerId: asset.ownerId,
    visibility: 'PUBLIC',
    moderation: 'PENDING',
    status: 'PROCESSING',
    scope: 'GLOBAL',
    scopeId: null,
    folderId: sub.id,
  })
  check('owner has MANAGE even while pending', permOwner === 'MANAGE', String(permOwner))

  // Grant EDIT to a specific user, verify union resolution (pure core).
  await addGrant({
    assetId: asset.id,
    subjectType: 'USER',
    subjectId: 'user_collab',
    permission: 'EDIT',
  })
  const collab = await buildMediaSubject({ id: 'user_collab', role: 'USER' } as never)
  const permCollab = await resolveAssetPermission(collab, asset.id, {
    ownerId: asset.ownerId,
    visibility: 'PRIVATE',
    moderation: 'PENDING',
    status: 'PROCESSING',
    scope: 'GLOBAL',
    scopeId: null,
    folderId: sub.id,
  })
  check('granted collaborator gets EDIT on a private draft', permCollab === 'EDIT', String(permCollab))

  // ── Moderate → APPROVED + READY ────────────────────────────────────────────
  await setAssetModeration(asset.id, 'APPROVED')
  await setAssetStatus(asset.id, 'READY')
  const permAnonApproved = await resolveAssetPermission(anon, asset.id, {
    ownerId: asset.ownerId,
    visibility: 'PUBLIC',
    moderation: 'APPROVED',
    status: 'READY',
    scope: 'GLOBAL',
    scopeId: null,
    folderId: sub.id,
  })
  check('anon can VIEW a PUBLIC approved asset', permAnonApproved === 'VIEW', String(permAnonApproved))

  // ── Enrichment: embedding (OpenAI) + AI suggestion ─────────────────────────
  const enrich = await enrichAsset(asset.id)
  check('embedding written to pgvector', enrich.embedded, JSON.stringify(enrich))
  const embRow = await db.mediaEmbedding.findFirst({
    where: { assetId: asset.id },
    select: { dim: true },
  })
  check('embedding row has dim 1536', embRow?.dim === 1536, String(embRow?.dim))

  // ── Search: lexical (vi), facet, hybrid (semantic) ─────────────────────────
  const filter = toSearchFilter(anon) // anonymous → APPROVED + PUBLIC only

  const lex = await getSearch().query({ text: 'hình học', mode: 'lexical' }, filter)
  check(
    'lexical search (vi, tsvector trigger) finds the asset',
    lex.mode === 'lexical' && lex.hits.some((h) => h.assetId === asset.id),
    `mode=${lex.mode} hits=${lex.hits.length}`,
  )

  const facet = await getSearch().query({ anyTags: ['math'] }, filter)
  check(
    'facet browse by ancestor tag "math" finds it',
    facet.hits.some((h) => h.assetId === asset.id),
    `hits=${facet.hits.length}`,
  )

  const hybrid = await getSearch().query({ text: 'bài học tam giác toán', mode: 'hybrid' }, filter)
  check(
    'hybrid search (RRF, semantic+lexical) finds it',
    hybrid.hits.some((h) => h.assetId === asset.id),
    `mode=${hybrid.mode} hits=${hybrid.hits.length}`,
  )

  const en = await getSearch().query({ text: 'triangle geometry', mode: 'hybrid' }, filter)
  check(
    'hybrid search (en) finds it',
    en.hits.some((h) => h.assetId === asset.id),
    `mode=${en.mode} hits=${en.hits.length}`,
  )

  // ── Folder-inherited grant in the search pre-filter ────────────────────────
  await updateAsset(asset.id, { visibility: 'PRIVATE' }) // now only grants apply
  await addGrant({
    folderId: root.id,
    subjectType: 'USER',
    subjectId: 'user_folder_grantee',
    permission: 'VIEW',
  })
  const grantee = await buildMediaSubject({ id: 'user_folder_grantee', role: 'USER' } as never)
  const inh = await getSearch().query({ text: 'hình học', mode: 'lexical' }, toSearchFilter(grantee))
  check(
    'folder-inherited grant lets grantee find a PRIVATE asset',
    inh.hits.some((h) => h.assetId === asset.id),
    `hits=${inh.hits.length}`,
  )
  const stranger = await buildMediaSubject({ id: 'user_stranger', role: 'USER' } as never)
  const noacc = await getSearch().query({ text: 'hình học', mode: 'lexical' }, toSearchFilter(stranger))
  check(
    'stranger cannot find the PRIVATE asset',
    !noacc.hits.some((h) => h.assetId === asset.id),
    `hits=${noacc.hits.length}`,
  )

  // ── Service-token RAG path ─────────────────────────────────────────────────
  check('resolveServiceToken maps token→label', resolveServiceToken('tok-test') === 'ai-rag')
  await addGrant({
    assetId: asset.id,
    subjectType: 'SERVICE',
    subjectId: 'ai-rag',
    permission: 'VIEW',
  })
  const svc = await buildMediaSubject(null, 'ai-rag')
  const svcRes = await getSearch().query({ text: 'triangle', mode: 'lexical' }, toSearchFilter(svc))
  check(
    'service subject finds PRIVATE asset via SERVICE grant',
    svcRes.hits.some((h) => h.assetId === asset.id),
    `hits=${svcRes.hits.length}`,
  )
  const noSvc = await getSearch().query(
    { text: 'triangle', mode: 'lexical' },
    toSearchFilter(await buildMediaSubject(null)),
  )
  check(
    'anon (no token) cannot find the PRIVATE asset',
    !noSvc.hits.some((h) => h.assetId === asset.id),
    `hits=${noSvc.hits.length}`,
  )

  // ── Cleanup ────────────────────────────────────────────────────────────────
  try {
    await storage.deleteObject(key)
  } catch (err) {
    console.warn('cleanup: failed to delete R2 object', err instanceof Error ? err.message : err)
  }
  for (const id of cleanup.assets) await deleteAsset(id).catch(() => {})
  for (const id of cleanup.folders) await db.mediaFolder.delete({ where: { id } }).catch(() => {})
  await db.tag.deleteMany({ where: { id: { in: [alias.id, geo.id, math.id] } } }).catch(() => {})
  // sanity: asset gone
  check('asset deleted on cleanup', (await getAssetById(cleanup.assets[0]!)) === null)

  console.log(`\n${fail === 0 ? '🎉' : '⚠️ '} ${pass} passed, ${fail} failed`)
  await db.$disconnect()
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error('E2E crashed:', err)
  await db.$disconnect()
  process.exit(1)
})

// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { buildTreePath, normalizeTagSlug, pathToIds, type LocalizedText } from '@bingoo.ai/core'
import { db } from '@bingoo.ai/db'
import type { TagKind, TagRelType } from '@bingoo.ai/db'

/**
 * Tag taxonomy (docs/media-library-design.md §3.6) — a hierarchical controlled
 * vocabulary (materialised path, like folders/orgs) that classifies assets on
 * facet dimensions. Stable slugs are the reference (M6). Two recall boosters:
 *  • an asset's denormalised `keywords` includes every ANCESTOR slug, so a filter
 *    on a broad tag ("math") matches assets tagged with a narrow child ("geometry").
 *  • ALIAS/RELATED relations expand a query's tag set (see expandTagSlugs).
 */

export interface UpsertTagInput {
  slug?: string // defaults to a normalised label
  kind: TagKind
  label: LocalizedText
  description?: LocalizedText
  parentId?: string | null
  externalRef?: string | null
}

/** Create or update a tag by slug, maintaining its materialised path. */
export async function upsertTag(input: UpsertTagInput) {
  const slug = normalizeTagSlug(input.slug ?? input.label.en ?? input.label.vi ?? '')
  if (!slug) throw new Error('tag slug is empty')

  let path = ''
  if (input.parentId) {
    const parent = await db.tag.findUnique({
      where: { id: input.parentId },
      select: { path: true },
    })
    if (!parent) throw new Error('parent tag not found')
    path = parent.path // completed with own id after create
  }

  const existing = await db.tag.findUnique({ where: { slug }, select: { id: true } })
  if (existing) {
    return db.tag.update({
      where: { slug },
      data: {
        kind: input.kind,
        label: input.label,
        description: input.description ?? undefined,
        parentId: input.parentId ?? null,
        path: buildTreePath(path, existing.id),
        externalRef: input.externalRef ?? null,
      },
    })
  }

  // Create then set path (needs the generated id).
  const created = await db.tag.create({
    data: {
      slug,
      kind: input.kind,
      label: input.label,
      description: input.description ?? undefined,
      parentId: input.parentId ?? null,
      externalRef: input.externalRef ?? null,
    },
  })
  return db.tag.update({
    where: { id: created.id },
    data: { path: buildTreePath(path, created.id) },
  })
}

export function getTagBySlug(slug: string) {
  return db.tag.findUnique({ where: { slug } })
}

export function listTags(kind?: TagKind) {
  return db.tag.findMany({
    where: kind ? { kind } : undefined,
    orderBy: [{ kind: 'asc' }, { path: 'asc' }],
  })
}

export function relateTags(fromId: string, toId: string, relType: TagRelType, weight = 1) {
  return db.tagRelation.upsert({
    where: { fromId_toId_relType: { fromId, toId, relType } },
    create: { fromId, toId, relType, weight },
    update: { weight },
  })
}

/**
 * Expand a set of tag slugs for querying: include ALIAS synonyms and BROADER
 * children so "hình học" also matches assets tagged only with a synonym or a
 * sub-topic. Bounded to one hop (recall vs. drift). Returns the union of slugs.
 */
export async function expandTagSlugs(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return []
  const tags = await db.tag.findMany({ where: { slug: { in: slugs } }, select: { id: true } })
  const ids = tags.map((t) => t.id)
  if (ids.length === 0) return slugs

  const rels = await db.tagRelation.findMany({
    where: {
      OR: [
        { fromId: { in: ids }, relType: { in: ['ALIAS', 'BROADER'] } },
        { toId: { in: ids }, relType: 'ALIAS' },
      ],
    },
    select: { fromId: true, toId: true },
  })
  const relatedIds = new Set<string>()
  for (const r of rels) {
    relatedIds.add(r.fromId)
    relatedIds.add(r.toId)
  }
  const extra = await db.tag.findMany({
    where: { id: { in: [...relatedIds] } },
    select: { slug: true },
  })
  return [...new Set([...slugs, ...extra.map((t) => t.slug)])]
}

/**
 * The keyword projection for an asset (invariant M2): every tag's slug PLUS each
 * of its ancestor slugs (via the materialised path). Written to media_asset.keywords
 * (GIN) so a facet filter on any ancestor is a single indexed array-overlap.
 */
export async function computeAssetKeywords(assetId: string): Promise<string[]> {
  const tags = await db.mediaTag.findMany({
    where: { assetId },
    select: { tag: { select: { slug: true, path: true } } },
  })
  const ancestorIds = new Set<string>()
  for (const { tag } of tags) for (const id of pathToIds(tag.path)) ancestorIds.add(id)

  const ancestors = ancestorIds.size
    ? await db.tag.findMany({ where: { id: { in: [...ancestorIds] } }, select: { slug: true } })
    : []

  return [...new Set([...tags.map((t) => t.tag.slug), ...ancestors.map((a) => a.slug)])]
}

export interface SetAssetTagsInput {
  assetId: string
  tagIds: string[]
  source?: 'MANUAL' | 'AI' | 'IMPORT'
  confidence?: number | null
  addedById?: string | null
}

/** Attach tags to an asset (idempotent) and refresh its keyword projection. */
export async function addAssetTags(input: SetAssetTagsInput): Promise<string[]> {
  if (input.tagIds.length > 0) {
    await db.mediaTag.createMany({
      data: input.tagIds.map((tagId) => ({
        assetId: input.assetId,
        tagId,
        source: input.source ?? 'MANUAL',
        confidence: input.confidence ?? null,
        addedById: input.addedById ?? null,
      })),
      skipDuplicates: true,
    })
  }
  const keywords = await computeAssetKeywords(input.assetId)
  await db.mediaAsset.update({ where: { id: input.assetId }, data: { keywords } })
  return keywords
}

export async function removeAssetTag(assetId: string, tagId: string): Promise<string[]> {
  await db.mediaTag.deleteMany({ where: { assetId, tagId } })
  const keywords = await computeAssetKeywords(assetId)
  await db.mediaAsset.update({ where: { id: assetId }, data: { keywords } })
  return keywords
}

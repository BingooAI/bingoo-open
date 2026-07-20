import type { LocalizedText, MediaSearchQuery } from '@bingoo.ai/core'
import { db } from '@bingoo.ai/db'
import type { MediaScope, Prisma } from '@bingoo.ai/db'

/**
 * Collections (docs/media-library-design.md §3.8) — virtual grouping (M4). A
 * manual collection holds explicit CollectionItems; a smart collection stores a
 * search DSL in `query` and is resolved live. Either way an asset can appear in
 * many collections with a single copy of the bytes.
 */

export interface CreateCollectionInput {
  name: LocalizedText
  description?: LocalizedText
  scope?: MediaScope
  scopeId?: string | null
  isSmart?: boolean
  query?: MediaSearchQuery
  createdById?: string | null
}

export function createCollection(input: CreateCollectionInput) {
  return db.collection.create({
    data: {
      name: input.name,
      description: input.description ?? undefined,
      scope: input.scope ?? 'GLOBAL',
      scopeId: input.scopeId ?? null,
      isSmart: input.isSmart ?? false,
      query: input.isSmart ? (input.query as Prisma.InputJsonValue) : undefined,
      createdById: input.createdById ?? null,
    },
  })
}

export function getCollection(id: string) {
  return db.collection.findUnique({ where: { id } })
}

export function listCollections(scope?: MediaScope, scopeId?: string | null) {
  return db.collection.findMany({
    where: {
      ...(scope ? { scope } : {}),
      ...(scopeId !== undefined ? { scopeId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function addCollectionItem(
  collectionId: string,
  assetId: string,
  addedById: string | null,
  position = 0,
) {
  return db.collectionItem.upsert({
    where: { collectionId_assetId: { collectionId, assetId } },
    create: { collectionId, assetId, addedById, position },
    update: { position },
  })
}

export function removeCollectionItem(collectionId: string, assetId: string) {
  return db.collectionItem.deleteMany({ where: { collectionId, assetId } })
}

/** Asset ids of a manual collection, in curated order. */
export async function listCollectionItemIds(collectionId: string): Promise<string[]> {
  const items = await db.collectionItem.findMany({
    where: { collectionId },
    orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
    select: { assetId: true },
  })
  return items.map((i) => i.assetId)
}

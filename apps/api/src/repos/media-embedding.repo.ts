import { db, Prisma } from '@bingoo/db'

/**
 * Semantic index writes (docs/media-library-design.md §3.9). The `embedding`
 * column is pgvector (Unsupported in Prisma), so we upsert the row's scalar
 * fields via the Prisma client, then set the vector with a raw UPDATE. One row
 * per (asset, model); `contentHash` lets the enrichment pipeline skip re-embedding
 * unchanged content.
 */

export interface UpsertEmbeddingInput {
  assetId: string
  model: string
  dim: number
  vector: number[]
  contentHash?: string | null
}

export async function upsertEmbedding(input: UpsertEmbeddingInput): Promise<void> {
  const row = await db.mediaEmbedding.upsert({
    where: { assetId_model: { assetId: input.assetId, model: input.model } },
    create: {
      assetId: input.assetId,
      model: input.model,
      dim: input.dim,
      contentHash: input.contentHash ?? null,
    },
    update: { dim: input.dim, contentHash: input.contentHash ?? null },
    select: { id: true },
  })
  const literal = `[${input.vector.join(',')}]`
  await db.$executeRaw(
    Prisma.sql`UPDATE "media_embedding" SET "embedding" = ${literal}::vector, "updatedAt" = now() WHERE "id" = ${row.id}`,
  )
}

/** The contentHash currently stored for an asset+model, or null. */
export async function currentEmbeddingHash(assetId: string, model: string): Promise<string | null> {
  const row = await db.mediaEmbedding.findUnique({
    where: { assetId_model: { assetId, model } },
    select: { contentHash: true },
  })
  return row?.contentHash ?? null
}

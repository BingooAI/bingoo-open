import {
  MEDIA_SEARCH_DEFAULT_LIMIT,
  MEDIA_SEARCH_MAX_LIMIT,
  reciprocalRankFusion,
  resolveSearchMode,
  type MediaSearchQuery,
} from '@bingoo.ai/core'
import { db, Prisma } from '@bingoo.ai/db'
import type { ProviderAdapter } from '../../core/registry'
import { embeddingRegistry } from '../../embedding'
import type { SearchFilter, SearchHit, SearchPort, SearchResult } from '../port'

interface ScoredRow {
  id: string
  score: number
}

/** Candidate pool per lane before fusion/truncation. */
function poolSize(limit: number): number {
  return Math.min(MEDIA_SEARCH_MAX_LIMIT * 2, Math.max(limit * 4, 50))
}

function clampLimit(limit?: number): number {
  if (!limit || limit < 1) return MEDIA_SEARCH_DEFAULT_LIMIT
  return Math.min(limit, MEDIA_SEARCH_MAX_LIMIT)
}

/** AND-joined predicates: facet filters + permission pre-filter (§5). Never
 *  interpolates raw text — every value is a bound parameter. */
function buildWhere(q: MediaSearchQuery, f: SearchFilter): Prisma.Sql {
  const conds: Prisma.Sql[] = [Prisma.sql`a."moderation"::text = ANY(${f.moderation})`]

  if (q.kind?.length) conds.push(Prisma.sql`a."kind"::text = ANY(${q.kind})`)
  if (q.anyTags?.length) conds.push(Prisma.sql`a."keywords" && ${q.anyTags}`)
  if (q.allTags?.length) conds.push(Prisma.sql`a."keywords" @> ${q.allTags}`)
  if (q.locale) conds.push(Prisma.sql`a."locale" = ${q.locale}`)
  if (q.license?.length) conds.push(Prisma.sql`a."license" = ANY(${q.license})`)
  if (q.ageRating?.length) conds.push(Prisma.sql`a."ageRating" = ANY(${q.ageRating})`)
  if (q.folderId) {
    conds.push(
      Prisma.sql`a."folderId" IN (
        SELECT id FROM "media_folder"
        WHERE "path" LIKE (SELECT "path" FROM "media_folder" WHERE id = ${q.folderId}) || '%'
      )`,
    )
  }

  if (!f.staff) {
    conds.push(Prisma.sql`(
      a."visibility"::text = 'PUBLIC'
      OR (a."visibility"::text = 'SCOPE' AND (
            (a."scope"::text = 'GLOBAL' AND ${f.authenticated})
            OR a."scopeId" = ANY(${f.accessibleScopeIds})
      ))
      OR (${f.userId}::text IS NOT NULL AND a."ownerId" = ${f.userId})
      OR EXISTS (
        SELECT 1 FROM "media_grant" g WHERE (
          g."subjectType"::text = 'PUBLIC'
          OR g."subjectId" = ANY(${f.grantSubjectIds})
          OR (g."subjectType"::text = 'ROLE' AND g."subjectId" = ANY(${f.platformRoles}))
          OR (${f.serviceKey}::text IS NOT NULL AND g."subjectType"::text = 'SERVICE' AND g."subjectId" = ${f.serviceKey})
        ) AND (
          g."assetId" = a."id"
          OR (
            g."folderId" IS NOT NULL AND a."folderId" IS NOT NULL
            AND (SELECT af."path" FROM "media_folder" af WHERE af.id = a."folderId")
                LIKE (SELECT gf."path" FROM "media_folder" gf WHERE gf.id = g."folderId") || '%'
          )
        )
      )
    )`)
  }

  return Prisma.join(conds, ' AND ')
}

function lexical(q: MediaSearchQuery, where: Prisma.Sql, k: number): Promise<ScoredRow[]> {
  const text = q.text ?? ''
  return db.$queryRaw<ScoredRow[]>(Prisma.sql`
    SELECT a."id" AS id,
           ts_rank(a."searchVector", websearch_to_tsquery('simple', ${text}))::float8 AS score
    FROM "media_asset" a
    WHERE a."searchVector" @@ websearch_to_tsquery('simple', ${text}) AND ${where}
    ORDER BY score DESC
    LIMIT ${k}
  `)
}

function browse(where: Prisma.Sql, k: number): Promise<ScoredRow[]> {
  return db.$queryRaw<ScoredRow[]>(Prisma.sql`
    SELECT a."id" AS id, extract(epoch FROM a."createdAt")::float8 AS score
    FROM "media_asset" a
    WHERE ${where}
    ORDER BY a."createdAt" DESC
    LIMIT ${k}
  `)
}

function semantic(vecLiteral: string, model: string, where: Prisma.Sql, k: number): Promise<ScoredRow[]> {
  return db.$queryRaw<ScoredRow[]>(Prisma.sql`
    SELECT e."assetId" AS id,
           (1 - (e."embedding" <=> ${vecLiteral}::vector))::float8 AS score
    FROM "media_embedding" e
    JOIN "media_asset" a ON a."id" = e."assetId"
    WHERE e."model" = ${model} AND ${where}
    ORDER BY e."embedding" <=> ${vecLiteral}::vector ASC
    LIMIT ${k}
  `)
}

export const postgresSearchAdapter: ProviderAdapter<SearchPort> = {
  key: 'postgres',
  requiredEnv: [], // uses the app's own Postgres (DATABASE_URL, via @bingoo.ai/db)
  create(): SearchPort {
    // Semantic retrieval is available only when the active embedding provider is
    // configured; otherwise we degrade to lexical transparently.
    const canEmbed = embeddingRegistry
      .health()
      .some((h) => h.provider === embeddingRegistry.activeKey && h.configured)

    return {
      canEmbed,
      async query(q: MediaSearchQuery, f: SearchFilter): Promise<SearchResult> {
        const limit = clampLimit(q.limit)
        const k = poolSize(limit)
        const where = buildWhere(q, f)
        const mode = resolveSearchMode(q, canEmbed)

        // Facet-only browse (no free text).
        if (!q.text) {
          const rows = await browse(where, limit)
          return { hits: rows.map((r) => ({ assetId: r.id, score: r.score })), mode: 'lexical' }
        }

        // Try to build a query embedding for semantic/hybrid modes.
        let vecLiteral: string | null = null
        let model = ''
        if (mode === 'semantic' || mode === 'hybrid') {
          try {
            const res = await embeddingRegistry.get().embed({ texts: [q.text] })
            const first = res.vectors[0]
            if (first) {
              vecLiteral = `[${first.join(',')}]`
              model = res.model
            }
          } catch {
            vecLiteral = null // provider missing/failed → fall back to lexical
          }
        }

        if (mode === 'semantic' && vecLiteral) {
          const rows = await semantic(vecLiteral, model, where, limit)
          return { hits: rows.map((r) => ({ assetId: r.id, score: r.score })), mode: 'semantic' }
        }

        if (mode === 'hybrid' && vecLiteral) {
          const [lex, sem] = await Promise.all([lexical(q, where, k), semantic(vecLiteral, model, where, k)])
          const fused = reciprocalRankFusion([lex.map((r) => r.id), sem.map((r) => r.id)])
          const hits: SearchHit[] = fused.slice(0, limit).map((h) => ({ assetId: h.id, score: h.score }))
          return { hits, mode: 'hybrid' }
        }

        // Default / fallback: lexical.
        const rows = await lexical(q, where, limit)
        return { hits: rows.map((r) => ({ assetId: r.id, score: r.score })), mode: 'lexical' }
      },
    }
  },
}

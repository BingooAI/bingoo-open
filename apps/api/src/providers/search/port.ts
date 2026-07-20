import type { MediaSearchMode, MediaSearchQuery, ModerationStatus } from '@bingoo/core'

/**
 * Media search capability (docs/media-library-design.md §4). The default adapter
 * is `postgres` (tsvector + pgvector on Neon, zero extra infra); a future
 * Meilisearch/Typesense adapter can replace it via the SEARCH_PROVIDER env
 * without touching call sites. Returns asset ids + scores only — the caller
 * hydrates the assets and re-checks fine-grained access (defense in depth).
 */
export interface SearchHit {
  assetId: string
  score: number
}

/**
 * The permission pre-filter, pre-computed by the service from the session (R6).
 * `staff` bypasses visibility/moderation gating; otherwise only assets that are
 * PUBLIC, in the subject's accessible scopes, owned by them, or granted to their
 * identity set are returned — including grants INHERITED from an ancestor folder
 * (matched by path prefix in the adapter), mirroring resolveMediaAccess.
 */
export interface SearchFilter {
  staff: boolean
  /** true when a real user is logged in (GLOBAL-scope + SCOPE visibility needs it). */
  authenticated: boolean
  userId: string | null
  serviceKey: string | null
  /** org/class/community ids the subject belongs to (for SCOPE visibility). */
  accessibleScopeIds: string[]
  /** identity ids that a USER/ORG/TEAM grant may target (userId ∪ orgIds ∪ teamIds). */
  grantSubjectIds: string[]
  platformRoles: string[]
  /** Allowed moderation states. Forced to ['APPROVED'] for non-staff (R5). */
  moderation: ModerationStatus[]
}

export interface SearchResult {
  hits: SearchHit[]
  mode: MediaSearchMode
}

export interface SearchPort {
  query(query: MediaSearchQuery, filter: SearchFilter): Promise<SearchResult>
  /** Whether semantic retrieval is available (an embedding provider is configured). */
  readonly canEmbed: boolean
}

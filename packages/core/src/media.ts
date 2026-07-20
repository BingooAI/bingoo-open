/**
 * Media library — platform-agnostic domain logic (docs/media-library-design.md).
 * PURE TS (R2): no DB, no UI, no next/react-native. The server assembles plain
 * facts from the DB and calls these; the same helpers run on the client for
 * optimistic UI. The string-union types MIRROR the Prisma enums in @bingoo/db —
 * kept here (not imported) because core must stay client-safe.
 */

// ── Vocabulary (mirrors @bingoo/db enums) ────────────────────────────────────

export type MediaKind =
  'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'ANIMATION' | 'FONT' | 'ARCHIVE' | 'OTHER';
export type MediaStatus = 'DRAFT' | 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED' | 'ARCHIVED';
export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
export type MediaScope = 'GLOBAL' | 'ORG' | 'CLASS' | 'COMMUNITY' | 'USER';
export type MediaVisibility = 'PRIVATE' | 'SCOPE' | 'PUBLIC';
export type GrantSubjectType = 'USER' | 'ORG' | 'TEAM' | 'ROLE' | 'SERVICE' | 'PUBLIC';
export type MediaPermission = 'VIEW' | 'USE' | 'EDIT' | 'MANAGE';
export type TagKind =
  | 'SUBJECT'
  | 'GRADE_BAND'
  | 'TOPIC'
  | 'STYLE'
  | 'LANGUAGE'
  | 'LICENSE'
  | 'AGE_RATING'
  | 'SOURCE'
  | 'ENTITY'
  | 'KEYWORD'
  | 'FORMAT';

/** Localised label ({vi,en,…}) — the same shape used for i18n Json columns (R4). */
export type LocalizedText = Record<string, string>;

// ── Materialised-path helpers (same scheme as Organization) ──────────────────

/** The path of a node = parent's path + its own id + ".". Root parent = "". */
export function buildTreePath(parentPath: string, id: string): string {
  return `${parentPath}${id}.`;
}

/** Ids of every ancestor + self, in root→leaf order, decoded from a path. */
export function pathToIds(path: string): string[] {
  return path.split('.').filter(Boolean);
}

/** True when `path` is at or below `ancestorPath` (prefix match). */
export function isAtOrBelow(path: string, ancestorPath: string): boolean {
  return ancestorPath === '' || path === ancestorPath || path.startsWith(ancestorPath);
}

// ── Tag slugs — stable references (invariant M6) ─────────────────────────────

/** Normalise a label into a stable, url-safe tag slug. Deterministic (no suffix)
 *  so the same concept always resolves to the same tag. */
export function normalizeTagSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics (Vietnamese)
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

// ── Permission resolution (server-enforced, R1/R6) ───────────────────────────

export const MEDIA_PERMISSION_RANK: Record<MediaPermission, number> = {
  VIEW: 1,
  USE: 2,
  EDIT: 3,
  MANAGE: 4,
};

/** The higher-privilege of two permissions (null = no access). */
export function maxPermission(
  a: MediaPermission | null,
  b: MediaPermission | null,
): MediaPermission | null {
  if (a === null) return b;
  if (b === null) return a;
  return MEDIA_PERMISSION_RANK[a] >= MEDIA_PERMISSION_RANK[b] ? a : b;
}

/** True when `held` satisfies the `required` permission (rank ≥). */
export function permissionSatisfies(
  held: MediaPermission | null,
  required: MediaPermission,
): boolean {
  return held !== null && MEDIA_PERMISSION_RANK[held] >= MEDIA_PERMISSION_RANK[required];
}

export interface MediaGrantFact {
  subjectType: GrantSubjectType;
  subjectId: string | null;
  permission: MediaPermission;
}

/** Who is asking — assembled by the server from the session (R6). */
export interface MediaAccessSubject {
  userId: string | null; // null = anonymous
  platformRoles: string[]; // e.g. ['ADMIN','CONTENT_EDITOR']
  orgIds: string[]; // orgs the user is a member of
  teamIds: string[];
  serviceKey?: string | null; // machine/AI consumer identity
}

/** The resource being accessed — grants already merged (asset + inherited folder). */
export interface MediaResourceFacts {
  ownerId: string | null;
  visibility: MediaVisibility;
  moderation: ModerationStatus;
  status: MediaStatus;
  grants: MediaGrantFact[];
  /** Does the subject belong to the owning org/class/community? (server-computed) */
  subjectInScope: boolean;
}

/** Platform-role floor: staff bypass visibility + moderation gating (they must be
 *  able to review PENDING/PRIVATE assets). Least-privilege ranking. */
function staffFloor(roles: string[]): MediaPermission | null {
  if (roles.includes('ADMIN')) return 'MANAGE';
  if (roles.includes('CONTENT_EDITOR')) return 'EDIT';
  if (roles.includes('MODERATOR')) return 'VIEW';
  return null;
}

function grantApplies(g: MediaGrantFact, s: MediaAccessSubject): boolean {
  switch (g.subjectType) {
    case 'PUBLIC':
      return true;
    case 'USER':
      return s.userId !== null && g.subjectId === s.userId;
    case 'ORG':
      return g.subjectId !== null && s.orgIds.includes(g.subjectId);
    case 'TEAM':
      return g.subjectId !== null && s.teamIds.includes(g.subjectId);
    case 'ROLE':
      return g.subjectId !== null && s.platformRoles.includes(g.subjectId);
    case 'SERVICE':
      return s.serviceKey != null && g.subjectId === s.serviceKey;
  }
}

/**
 * Effective permission = the HIGHEST across the union of: staff floor, ownership,
 * explicit grants, and visibility baseline (§5). Child-safety (R5): the
 * visibility baseline (PUBLIC/SCOPE) only applies to APPROVED assets — a
 * not-yet-moderated asset is reachable only by staff, its owner, or someone given
 * an explicit grant (e.g. a collaborator editing a draft). Returns null = denied.
 */
export function resolveMediaAccess(
  subject: MediaAccessSubject,
  resource: MediaResourceFacts,
): MediaPermission | null {
  let result: MediaPermission | null = staffFloor(subject.platformRoles);

  if (resource.ownerId !== null && resource.ownerId === subject.userId) {
    result = maxPermission(result, 'MANAGE');
  }

  // Explicit grants apply regardless of moderation (deliberate access).
  for (const g of resource.grants) {
    if (grantApplies(g, subject)) result = maxPermission(result, g.permission);
  }

  // Visibility baseline only for APPROVED assets.
  if (resource.moderation === 'APPROVED') {
    if (resource.visibility === 'PUBLIC' && resource.status === 'READY') {
      result = maxPermission(result, 'VIEW');
    } else if (resource.visibility === 'SCOPE' && resource.subjectInScope) {
      result = maxPermission(result, 'VIEW');
    }
  }

  return result;
}

// ── Search query DSL — typed, never raw SQL (like the segment DSL) ───────────

export type MediaSearchMode = 'auto' | 'lexical' | 'semantic' | 'hybrid';

/**
 * A structured search request. The server compiles this into parameterised SQL
 * (facets → GIN, `text` → tsvector + pgvector); nothing here is interpolated, so
 * a query can't inject SQL. `mode=auto` picks hybrid when `text` is present and
 * an embedding is available, else lexical.
 */
export interface MediaSearchQuery {
  text?: string;
  mode?: MediaSearchMode;
  kind?: MediaKind[];
  /** Tag slugs — match assets carrying ANY of these (facet OR). */
  anyTags?: string[];
  /** Tag slugs — match assets carrying ALL of these (facet AND). */
  allTags?: string[];
  locale?: string;
  license?: string[];
  ageRating?: string[];
  /** Restrict to a folder subtree (by folder id; server resolves the path). */
  folderId?: string;
  /** Only these moderation states (defaults to APPROVED for non-staff callers). */
  moderation?: ModerationStatus[];
  limit?: number;
  cursor?: string;
}

export const MEDIA_SEARCH_MAX_LIMIT = 100;
export const MEDIA_SEARCH_DEFAULT_LIMIT = 24;

/** Resolve the effective retrieval mode from the query + capability. */
export function resolveSearchMode(query: MediaSearchQuery, canEmbed: boolean): MediaSearchMode {
  if (query.mode && query.mode !== 'auto') return query.mode;
  if (!query.text) return 'lexical'; // pure facet browse → lexical path (ranks by recency)
  return canEmbed ? 'hybrid' : 'lexical';
}

// ── Reciprocal Rank Fusion — combine lexical + semantic result orderings ─────

export interface FusedHit {
  id: string;
  score: number;
}

/**
 * RRF (Reciprocal Rank Fusion): merge several ranked id-lists into one order by
 * `Σ 1/(k + rank)`. Rank-based, so it fuses lexical (ts_rank) and semantic
 * (cosine) results without normalising their incomparable score scales. `k`
 * dampens the contribution of lower ranks (60 is the common default).
 */
export function reciprocalRankFusion(lists: readonly (readonly string[])[], k = 60): FusedHit[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

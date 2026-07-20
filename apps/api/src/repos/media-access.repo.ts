import {
  resolveMediaAccess,
  type MediaAccessSubject,
  type MediaGrantFact,
  type MediaPermission,
  type MediaResourceFacts,
} from '@bingoo/core';
import { db } from '@bingoo/db';
import type { GrantSubjectType, MediaScope, MediaVisibility } from '@bingoo/db';
import type { SessionUser } from '../auth/auth';
import { parseRoles } from '../auth/roles';
import type { SearchFilter } from '../providers/search/port';

/**
 * Access resolution for media (docs/media-library-design.md §5). All authz is
 * enforced HERE on the server (R1/R6). The subject is assembled from the session;
 * a resource's grants are the UNION of its own grants and every ancestor folder's
 * grants (inheritance down the tree). resolveMediaAccess (pure, @bingoo/core)
 * folds these into a single effective permission.
 */

export interface MediaSubject extends MediaAccessSubject {
  /** true when a real user is logged in (GLOBAL+SCOPE assets need this). */
  authenticated: boolean;
  /** org/class/community ids the user belongs to — for SCOPE visibility. */
  accessibleScopeIds: string[];
}

const STAFF_ROLES = ['ADMIN', 'CONTENT_EDITOR', 'MODERATOR'];

/** Assemble the media subject from the session (memberships resolved once). */
export async function buildMediaSubject(
  user: SessionUser | null,
  serviceKey: string | null = null,
): Promise<MediaSubject> {
  if (!user) {
    return {
      userId: null,
      platformRoles: [],
      orgIds: [],
      teamIds: [],
      serviceKey,
      authenticated: false,
      accessibleScopeIds: [],
    };
  }

  const [members, teamMembers, classMembers, communityMembers] = await Promise.all([
    db.member.findMany({ where: { userId: user.id }, select: { organizationId: true } }),
    db.teamMember.findMany({ where: { userId: user.id }, select: { teamId: true } }),
    db.classMember.findMany({
      where: { userId: user.id, status: 'active' },
      select: { classId: true },
    }),
    db.communityMember.findMany({
      where: { userId: user.id, status: 'active' },
      select: { communityId: true },
    }),
  ]);

  const orgIds = members.map((m) => m.organizationId);
  const teamIds = teamMembers.map((t) => t.teamId);
  const classIds = classMembers.map((c) => c.classId);
  const communityIds = communityMembers.map((c) => c.communityId);

  return {
    userId: user.id,
    platformRoles: parseRoles(user.role),
    orgIds,
    teamIds,
    serviceKey,
    authenticated: true,
    // SCOPE visibility matches when an asset's scopeId is one the user belongs to
    // (own userId for USER-scoped, org/class/community id otherwise).
    accessibleScopeIds: [user.id, ...orgIds, ...classIds, ...communityIds],
  };
}

/** Grants on an asset PLUS grants on every ancestor folder (inheritance, §5). */
async function collectGrants(assetId: string, folderId: string | null): Promise<MediaGrantFact[]> {
  let folderIds: string[] = [];
  if (folderId) {
    const folder = await db.mediaFolder.findUnique({
      where: { id: folderId },
      select: { path: true },
    });
    folderIds = folder ? folder.path.split('.').filter(Boolean) : [];
  }

  const rows = await db.mediaGrant.findMany({
    where: {
      OR: [{ assetId }, ...(folderIds.length ? [{ folderId: { in: folderIds } }] : [])],
    },
    select: { subjectType: true, subjectId: true, permission: true },
  });
  return rows.map((r) => ({
    subjectType: r.subjectType,
    subjectId: r.subjectId,
    permission: r.permission,
  }));
}

function subjectInScope(subject: MediaSubject, scope: MediaScope, scopeId: string | null): boolean {
  if (scope === 'GLOBAL') return subject.authenticated;
  return scopeId !== null && subject.accessibleScopeIds.includes(scopeId);
}

interface AccessResourceRow {
  ownerId: string | null;
  visibility: MediaVisibility;
  moderation: MediaResourceFacts['moderation'];
  status: MediaResourceFacts['status'];
  scope: MediaScope;
  scopeId: string | null;
  folderId: string | null;
}

/** Effective permission on one asset for the subject, or null if denied. */
export async function resolveAssetPermission(
  subject: MediaSubject,
  assetId: string,
  resource: AccessResourceRow,
): Promise<MediaPermission | null> {
  const grants = await collectGrants(assetId, resource.folderId);
  const facts: MediaResourceFacts = {
    ownerId: resource.ownerId,
    visibility: resource.visibility,
    moderation: resource.moderation,
    status: resource.status,
    grants,
    subjectInScope: subjectInScope(subject, resource.scope, resource.scopeId),
  };
  return resolveMediaAccess(subject, facts);
}

/** Effective permission on a folder (folders have no moderation → treat APPROVED). */
export async function resolveFolderPermission(
  subject: MediaSubject,
  folderId: string,
): Promise<MediaPermission | null> {
  const folder = await db.mediaFolder.findUnique({
    where: { id: folderId },
    select: { path: true, visibility: true, scope: true, scopeId: true, createdById: true },
  });
  if (!folder) return null;

  const folderIds = folder.path.split('.').filter(Boolean);
  const rows = await db.mediaGrant.findMany({
    where: { folderId: { in: folderIds } },
    select: { subjectType: true, subjectId: true, permission: true },
  });
  const facts: MediaResourceFacts = {
    ownerId: folder.createdById,
    visibility: folder.visibility,
    moderation: 'APPROVED',
    status: 'READY',
    grants: rows.map((r) => ({
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      permission: r.permission,
    })),
    subjectInScope: subjectInScope(subject, folder.scope, folder.scopeId),
  };
  return resolveMediaAccess(subject, facts);
}

/** Compile the search permission pre-filter from the subject (§4/§5). */
export function toSearchFilter(subject: MediaSubject, staffOnlyModeration = false): SearchFilter {
  const staff = subject.platformRoles.some((r) => STAFF_ROLES.includes(r));
  return {
    staff,
    authenticated: subject.authenticated,
    userId: subject.userId,
    serviceKey: subject.serviceKey ?? null,
    accessibleScopeIds: subject.accessibleScopeIds,
    grantSubjectIds: subject.userId
      ? [subject.userId, ...subject.orgIds, ...subject.teamIds]
      : [...subject.orgIds, ...subject.teamIds],
    platformRoles: subject.platformRoles,
    // Non-staff only ever see APPROVED assets (R5). Staff may see everything
    // unless the caller narrows it.
    moderation:
      staff && !staffOnlyModeration ? ['APPROVED', 'PENDING', 'FLAGGED', 'REJECTED'] : ['APPROVED'],
  };
}

// ── Grant CRUD ───────────────────────────────────────────────────────────────

export interface AddGrantInput {
  folderId?: string | null;
  assetId?: string | null;
  subjectType: GrantSubjectType;
  subjectId?: string | null;
  permission: MediaPermission;
  createdById?: string | null;
}

/** Idempotent grant add. Not an upsert: the unique key includes a NULLable
 *  subjectId (PUBLIC grants), which Postgres treats as distinct and Prisma won't
 *  accept in a where-unique — so we match-then-create instead. */
export async function addGrant(input: AddGrantInput) {
  const match = {
    folderId: input.folderId ?? null,
    assetId: input.assetId ?? null,
    subjectType: input.subjectType,
    subjectId: input.subjectId ?? null,
    permission: input.permission,
  };
  const existing = await db.mediaGrant.findFirst({ where: match });
  if (existing) return existing;
  return db.mediaGrant.create({ data: { ...match, createdById: input.createdById ?? null } });
}

export function listGrants(target: { assetId?: string; folderId?: string }) {
  return db.mediaGrant.findMany({
    where: target.assetId ? { assetId: target.assetId } : { folderId: target.folderId },
    orderBy: { createdAt: 'asc' },
  });
}

export function removeGrant(id: string) {
  return db.mediaGrant.delete({ where: { id } });
}

import { createMiddleware } from 'hono/factory'
import { db } from '@bingoo.ai/db'
import type { AppEnv } from '../lib/context'
import { AppError } from '../lib/errors'
import { resolveOrgRole, type OrgRole } from '../repos/org.repo'
import { getCommunityRole, type CommunityRole } from '../repos/community.repo'
import { hasAnyRole, type PlatformRole } from './roles'

/**
 * Authorization guards (§6). All authz is enforced HERE, on the server (R6) —
 * the client is never trusted. Each axis is separate and does NOT inherit from
 * another (least privilege / small blast radius): a platform role, an org role
 * and a class role are independent. Assumes the session middleware already ran.
 */

/** 401 unless a session is present. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user')) throw AppError.unauthorized()
  await next()
})

/**
 * Platform has-role guard: passes when the user carries ANY of `roles` in their
 * role set (multi-role, §4). e.g. `requireRole('TEACHER')`, `requireRole('ADMIN')`.
 */
export function requireRole(...roles: PlatformRole[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    if (!hasAnyRole(user.role, roles)) throw AppError.forbidden()
    await next()
  })
}

/**
 * Org-scoped role guard: passes when the user is a Member of the session's
 * ACTIVE organization holding ANY of `roles` (owner | admin | member).
 * Explicit and non-inherited (E) — an org role never implies a platform role,
 * and a parent org's role never implies a child org's (delegation is P5).
 */
export function requireOrgRole(...roles: string[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    const session = c.get('session')
    if (!user || !session) throw AppError.unauthorized()

    const organizationId = session.activeOrganizationId
    if (!organizationId) throw AppError.forbidden('No active organization')

    const member = await db.member.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
      select: { role: true },
    })
    if (!member || !roles.includes(member.role)) throw AppError.forbidden()

    await next()
  })
}

/**
 * Class-scoped role guard (§6): passes when the user is an ACTIVE ClassMember of
 * the `:classId` in the path holding ANY of `roles` (TEACHER | TA | TUTOR |
 * STUDENT). This is the per-class isolation — a teacher's authority never spills
 * to a class they aren't a member of.
 */
export function requireClassRole(...roles: string[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()

    const classId = c.req.param('classId')
    if (!classId) throw AppError.badRequest('Missing class id')

    const member = await db.classMember.findUnique({
      where: { classId_userId: { classId, userId: user.id } },
      select: { role: true, status: true },
    })
    if (!member || member.status !== 'active' || !roles.includes(member.role)) {
      throw AppError.forbidden()
    }

    await next()
  })
}

/**
 * Org-scoped access guard for hierarchy routes (§5, §6): passes when the user's
 * EFFECTIVE role on the `:orgId` in the path is one of `roles` — a direct Member
 * role, or `admin` inherited via opt-in `inheritAdmin` (chain-of-consent). This
 * is the per-org-param counterpart to requireOrgRole (which uses the active org).
 */
export function requireOrgAccess(...roles: OrgRole[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()

    const orgId = c.req.param('orgId')
    if (!orgId) throw AppError.badRequest('Missing organization id')

    const role = await resolveOrgRole(user.id, orgId)
    if (!role || !roles.includes(role)) throw AppError.forbidden()

    await next()
  })
}

/**
 * Community-scoped role guard (§5.1): passes when the user is an ACTIVE member of
 * the `:communityId` in the path with ANY of `roles` (owner | moderator | member).
 */
export function requireCommunityRole(...roles: CommunityRole[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()

    const communityId = c.req.param('communityId')
    if (!communityId) throw AppError.badRequest('Missing community id')

    const role = await getCommunityRole(communityId, user.id)
    if (!role || !roles.includes(role)) throw AppError.forbidden()

    await next()
  })
}

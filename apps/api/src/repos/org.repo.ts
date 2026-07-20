import { randomUUID } from 'node:crypto'
import { db } from '@bingoo.ai/db'
import { auth } from '../auth/auth'

/**
 * Organization hierarchy + scoped access (§5, §6). Orgs form a tree via
 * `parentId` and a materialized `path` ("root.child.self.") for O(1) ancestor /
 * descendant queries. Access is EXPLICIT by default (a Member row); the only
 * cross-level grant is opt-in `inheritAdmin`, resolved as chain-of-consent —
 * every org on the path down to the target must opt in — to keep blast radius
 * minimal. Managed directly (like classes/children) so we own path + hierarchy;
 * Better Auth's org plugin still reads these tables for activeOrganizationId.
 */

export type OrgRole = 'owner' | 'admin' | 'member'
const ORG_ADMIN_ROLES: OrgRole[] = ['owner', 'admin']

function slugify(name: string, suffix: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
  return `${base || 'org'}-${suffix}`
}

export interface CreateOrgInput {
  creatorId: string
  name: string
  type?: string | null // GROUP | COMPANY | SCHOOL | CENTER
  parentId?: string | null
}

/** Create an org (root or sub) with its materialized path + creator as owner. */
export async function createOrg(input: CreateOrgInput) {
  const ctx = await auth.$context
  const id = ctx.generateId({ model: 'organization' }) || randomUUID()
  const memberId = ctx.generateId({ model: 'member' }) || randomUUID()

  let path = `${id}.`
  if (input.parentId) {
    const parent = await db.organization.findUnique({
      where: { id: input.parentId },
      select: { path: true },
    })
    if (!parent) throw new Error('parent organization not found')
    path = `${parent.path}${id}.`
  }

  return db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        id,
        name: input.name,
        slug: slugify(input.name, id.slice(-6)),
        type: input.type ?? 'COMPANY',
        parentId: input.parentId ?? null,
        path,
      },
    })
    await tx.member.create({
      data: { id: memberId, organizationId: id, userId: input.creatorId, role: 'owner' },
    })
    return org
  })
}

export function getOrg(id: string) {
  return db.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      parentId: true,
      path: true,
      inheritAdmin: true,
      createdAt: true,
    },
  })
}

/** Ids of an org and all its descendants (subtree), via path prefix. */
export async function subtreeOrgIds(orgId: string): Promise<string[]> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { path: true } })
  if (!org) return []
  const rows = await db.organization.findMany({
    where: { path: { startsWith: org.path } },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

/** The org tree rooted at `orgId` (self + descendants). */
export async function getOrgTree(orgId: string) {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { path: true } })
  if (!org) return []
  return db.organization.findMany({
    where: { path: { startsWith: org.path } },
    orderBy: { path: 'asc' },
    select: { id: true, name: true, type: true, parentId: true, path: true, inheritAdmin: true },
  })
}

async function directMemberRole(userId: string, orgId: string): Promise<OrgRole | null> {
  const member = await db.member.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    select: { role: true },
  })
  return (member?.role as OrgRole | undefined) ?? null
}

/** Chain-of-consent: an ancestor admin reaches `orgId` only if every org on the
 *  way down (starting at the target) has `inheritAdmin` on (§6). */
async function hasInheritedAdmin(userId: string, orgId: string): Promise<boolean> {
  let cur = await db.organization.findUnique({
    where: { id: orgId },
    select: { parentId: true, inheritAdmin: true },
  })
  while (cur?.parentId && cur.inheritAdmin) {
    const role = await directMemberRole(userId, cur.parentId)
    if (role && ORG_ADMIN_ROLES.includes(role)) return true
    cur = await db.organization.findUnique({
      where: { id: cur.parentId },
      select: { parentId: true, inheritAdmin: true },
    })
  }
  return false
}

/** Effective org role: a direct Member role, else `admin` if inherited (§6). */
export async function resolveOrgRole(userId: string, orgId: string): Promise<OrgRole | null> {
  const direct = await directMemberRole(userId, orgId)
  if (direct) return direct
  if (await hasInheritedAdmin(userId, orgId)) return 'admin'
  return null
}

/** Add/update a member — the explicit-delegation primitive (§6). */
export async function addOrgMember(orgId: string, userId: string, role: OrgRole) {
  const ctx = await auth.$context
  return db.member.upsert({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    create: {
      id: ctx.generateId({ model: 'member' }) || randomUUID(),
      organizationId: orgId,
      userId,
      role,
    },
    update: { role },
  })
}

export async function listOrgMembers(orgId: string) {
  const rows = await db.member.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      createdAt: true,
      user: { select: { id: true, publicId: true, name: true, email: true } },
    },
  })
  return rows.map((r) => ({ ...r.user, orgRole: r.role, since: r.createdAt }))
}

export async function setInheritAdmin(orgId: string, value: boolean) {
  return db.organization.update({
    where: { id: orgId },
    data: { inheritAdmin: value },
    select: { id: true, inheritAdmin: true },
  })
}

/** Create a team (department), optionally nested under `parentTeamId` (§5). */
export async function createTeam(orgId: string, name: string, parentTeamId?: string | null) {
  const ctx = await auth.$context
  return db.team.create({
    data: {
      id: ctx.generateId({ model: 'team' }) || randomUUID(),
      organizationId: orgId,
      name,
      parentTeamId: parentTeamId ?? null,
    },
    select: { id: true, name: true, organizationId: true, parentTeamId: true, createdAt: true },
  })
}

export function listTeams(orgId: string) {
  return db.team.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, parentTeamId: true, createdAt: true },
  })
}

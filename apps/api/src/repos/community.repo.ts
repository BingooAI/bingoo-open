import { db } from '@bingoo.ai/db'
import { AppError } from '../lib/errors'

/**
 * Communities (§5.1) — social/content collectives, SEPARATE from Organization.
 * Discoverable, open/request join, own moderation. Child-safety (R5): a minor
 * (CHILD/TEEN) joins as `pending` until their guardian approves; a request/invite
 * community also needs a moderator's approval. Adults join freely per policy.
 */

export type CommunityRole = 'owner' | 'moderator' | 'member'
const MINOR_TIERS = new Set(['CHILD', 'TEEN'])
const MOD_ROLES: CommunityRole[] = ['owner', 'moderator']

function computeStatus(isMinor: boolean, moderatorApprovedAt: Date | null, guardianApprovedAt: Date | null) {
  const moderatorOk = moderatorApprovedAt !== null
  const guardianOk = !isMinor || guardianApprovedAt !== null
  return moderatorOk && guardianOk ? 'active' : 'pending'
}

export interface CreateCommunityInput {
  creatorId: string
  slug: string
  name: string
  description?: string | null
  visibility?: string
  joinPolicy?: string
}

export async function createCommunity(input: CreateCommunityInput) {
  return db.$transaction(async (tx) => {
    const community = await tx.community.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        visibility: input.visibility ?? 'public',
        joinPolicy: input.joinPolicy ?? 'request',
      },
    })
    await tx.communityMember.create({
      data: {
        communityId: community.id,
        userId: input.creatorId,
        role: 'owner',
        status: 'active',
        moderatorApprovedAt: new Date(),
      },
    })
    return community
  })
}

export function listDiscoverable() {
  return db.community.findMany({
    where: { visibility: 'public' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, slug: true, name: true, description: true, joinPolicy: true },
  })
}

export async function getCommunityRole(communityId: string, userId: string): Promise<CommunityRole | null> {
  const m = await db.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { role: true, status: true },
  })
  return m && m.status === 'active' ? (m.role as CommunityRole) : null
}

export function listMembers(communityId: string) {
  return db.communityMember.findMany({
    where: { communityId, status: { not: 'banned' } },
    orderBy: { joinedAt: 'asc' },
    select: {
      role: true,
      status: true,
      user: { select: { id: true, publicId: true, name: true } },
    },
  })
}

/** Self-join per policy + child-safety. Returns the (possibly pending) membership. */
export async function joinCommunity(userId: string, communityId: string) {
  const community = await db.community.findUnique({
    where: { id: communityId },
    select: { joinPolicy: true },
  })
  if (!community) throw AppError.notFound()

  const existing = await db.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { status: true },
  })
  if (existing?.status === 'banned') throw AppError.forbidden('Banned from this community')
  if (existing) throw AppError.conflict('Already a member or pending')

  const user = await db.user.findUnique({ where: { id: userId }, select: { accountType: true } })
  const isMinor = MINOR_TIERS.has(user?.accountType ?? '')
  // 'open' needs no moderator; 'request'/'invite' do.
  const moderatorApprovedAt = community.joinPolicy === 'open' ? new Date() : null
  const status = computeStatus(isMinor, moderatorApprovedAt, null)

  return db.communityMember.create({
    data: { communityId, userId, role: 'member', status, moderatorApprovedAt },
  })
}

async function refreshMember(communityId: string, userId: string) {
  const member = await db.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: {
      status: true,
      moderatorApprovedAt: true,
      guardianApprovedAt: true,
      user: { select: { accountType: true } },
    },
  })
  if (!member) throw AppError.notFound('Not a member')
  if (member.status === 'banned') throw AppError.badRequest('Member is banned')

  const isMinor = MINOR_TIERS.has(member.user.accountType ?? '')
  const status = computeStatus(isMinor, member.moderatorApprovedAt, member.guardianApprovedAt)
  return db.communityMember.update({
    where: { communityId_userId: { communityId, userId } },
    data: { status },
    select: { role: true, status: true, communityId: true, userId: true },
  })
}

/** A moderator/owner approves a pending request. */
export async function moderatorApprove(communityId: string, targetUserId: string) {
  await db.communityMember.update({
    where: { communityId_userId: { communityId, userId: targetUserId } },
    data: { moderatorApprovedAt: new Date() },
  })
  return refreshMember(communityId, targetUserId)
}

/** A minor's guardian approves their membership (child-safety, §5.1). */
export async function guardianApprove(communityId: string, targetUserId: string) {
  await db.communityMember.update({
    where: { communityId_userId: { communityId, userId: targetUserId } },
    data: { guardianApprovedAt: new Date() },
  })
  return refreshMember(communityId, targetUserId)
}

export function banMember(communityId: string, targetUserId: string) {
  return db.communityMember.update({
    where: { communityId_userId: { communityId, userId: targetUserId } },
    data: { status: 'banned' },
    select: { userId: true, status: true },
  })
}

export async function leaveCommunity(userId: string, communityId: string) {
  await db.communityMember.deleteMany({ where: { communityId, userId, role: { not: 'owner' } } })
}

export { MOD_ROLES }

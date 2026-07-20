import { db } from '@bingoo/db'
import { categoryOf, kinshipHonorific, reverseType, type RelationshipType } from '@bingoo/core'
import { AppError } from '../lib/errors'
import { isGuardianOf } from './children.repo'
import { shareAnyClass } from './class.repo'

/**
 * Social + family graph (§6). A relationship is display/connection ONLY — it
 * never grants account management (that's Guardianship). Adults connect freely;
 * for a minor (CHILD/TEEN) party the platform enforces child-safety (R5): SOCIAL
 * friends must be known contacts (a shared class or an existing confirmed
 * relationship) and a guardian must approve before it becomes confirmed.
 */

type RelStatus = 'pending' | 'confirmed' | 'blocked' | 'declined'

const MINOR_TIERS = new Set(['CHILD', 'TEEN'])
function isMinor(accountType: string | null | undefined): boolean {
  return accountType != null && MINOR_TIERS.has(accountType)
}

async function getRel(id: string) {
  return db.relationship.findUnique({ where: { id } })
}

/** Is a relationship of this type (or its reverse) already live between a & b? */
async function existingBetween(a: string, b: string, type: RelationshipType) {
  const types = [type, reverseType(type)]
  return db.relationship.findFirst({
    where: {
      status: { not: 'declined' },
      OR: [
        { fromUserId: a, toUserId: b, type: { in: types } },
        { fromUserId: b, toUserId: a, type: { in: types } },
      ],
    },
    select: { id: true, status: true },
  })
}

export interface RequestInput {
  requester: { id: string; accountType?: string | null }
  toUserId: string
  type: RelationshipType
}

/** Send a relationship request (from → to). Enforces the child-safety gate. */
export async function requestRelationship(input: RequestInput) {
  const { requester, toUserId, type } = input
  if (requester.id === toUserId) throw AppError.badRequest('Cannot relate to yourself')

  const target = await db.user.findUnique({
    where: { id: toUserId },
    select: { id: true, accountType: true },
  })
  if (!target) throw AppError.notFound('User not found')

  const existing = await existingBetween(requester.id, toUserId, type)
  if (existing?.status === 'blocked') throw AppError.forbidden('Blocked')
  if (existing) throw AppError.conflict('Relationship already exists')

  const category = categoryOf(type)
  const minorInvolved = isMinor(requester.accountType) || isMinor(target.accountType)

  // Child safety (R5, §6): a minor's SOCIAL friending is limited to known
  // contacts — no stranger discovery. Adults are unrestricted. FAMILY ties skip
  // this (you declare kin) but still need guardian approval below.
  if (category === 'SOCIAL' && minorInvolved) {
    const known =
      (await shareAnyClass(requester.id, toUserId)) ||
      (await hasConfirmedRelationship(requester.id, toUserId))
    if (!known) {
      throw AppError.forbidden('A minor can only friend known contacts (a shared class or family)')
    }
  }

  return db.relationship.create({
    data: {
      fromUserId: requester.id,
      toUserId,
      category,
      type,
      status: 'pending',
      requestedById: requester.id,
    },
  })
}

async function hasConfirmedRelationship(a: string, b: string): Promise<boolean> {
  const row = await db.relationship.findFirst({
    where: {
      status: 'confirmed',
      OR: [
        { fromUserId: a, toUserId: b },
        { fromUserId: b, toUserId: a },
      ],
    },
    select: { id: true },
  })
  return row !== null
}

/** Confirm once the recipient has accepted AND (if a minor is involved) a
 *  guardian has approved. */
async function tryConfirm(relId: string): Promise<void> {
  const rel = await db.relationship.findUnique({
    where: { id: relId },
    select: {
      status: true,
      respondedAt: true,
      guardianApprovedAt: true,
      fromUserId: true,
      toUserId: true,
    },
  })
  if (!rel || rel.status !== 'pending' || !rel.respondedAt) return

  const parties = await db.user.findMany({
    where: { id: { in: [rel.fromUserId, rel.toUserId] } },
    select: { accountType: true },
  })
  const needsGuardian = parties.some((p) => isMinor(p.accountType))
  if (needsGuardian && !rel.guardianApprovedAt) return

  await db.relationship.update({ where: { id: relId }, data: { status: 'confirmed' } })
}

async function isGuardianOfMinorParty(guardianId: string, rel: { fromUserId: string; toUserId: string }) {
  return (await isGuardianOf(guardianId, rel.fromUserId)) || (await isGuardianOf(guardianId, rel.toUserId))
}

/** Recipient (or their guardian if a minor) responds to a pending request. */
export async function respondToRelationship(actorId: string, relId: string, action: 'accept' | 'decline') {
  const rel = await getRel(relId)
  if (!rel) throw AppError.notFound()
  if (rel.status !== 'pending') throw AppError.badRequest('Already resolved')

  const recipient = await db.user.findUnique({
    where: { id: rel.toUserId },
    select: { accountType: true },
  })
  const allowed =
    actorId === rel.toUserId ||
    (isMinor(recipient?.accountType) && (await isGuardianOf(actorId, rel.toUserId)))
  if (!allowed) throw AppError.forbidden()

  if (action === 'decline') {
    return db.relationship.update({
      where: { id: relId },
      data: { status: 'declined', respondedAt: new Date() },
    })
  }
  await db.relationship.update({ where: { id: relId }, data: { respondedAt: new Date() } })
  await tryConfirm(relId)
  return getRel(relId)
}

/** A guardian of a minor party approves the relationship (§6). */
export async function approveRelationship(guardianId: string, relId: string) {
  const rel = await getRel(relId)
  if (!rel) throw AppError.notFound()
  if (rel.status === 'blocked' || rel.status === 'declined') throw AppError.badRequest('Resolved')
  if (!(await isGuardianOfMinorParty(guardianId, rel))) throw AppError.forbidden()

  await db.relationship.update({
    where: { id: relId },
    data: { guardianApprovedById: guardianId, guardianApprovedAt: new Date() },
  })
  await tryConfirm(relId)
  return getRel(relId)
}

/** Either party (or a minor's guardian) blocks the relationship. */
export async function blockRelationship(actorId: string, relId: string) {
  const rel = await getRel(relId)
  if (!rel) throw AppError.notFound()

  const isParty = actorId === rel.fromUserId || actorId === rel.toUserId
  if (!isParty && !(await isGuardianOfMinorParty(actorId, rel))) throw AppError.forbidden()

  return db.relationship.update({ where: { id: relId }, data: { status: 'blocked' } })
}

/** My relationships (both directions), each seen from MY perspective + honorific. */
export async function listRelationships(userId: string) {
  const [me, rows] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true } }),
    db.relationship.findMany({
      where: {
        status: { not: 'declined' },
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: { requestedAt: 'desc' },
      include: {
        from: { select: { id: true, publicId: true, name: true, gender: true, dateOfBirth: true } },
        to: { select: { id: true, publicId: true, name: true, gender: true, dateOfBirth: true } },
      },
    }),
  ])

  return rows.map((r) => {
    const iAmFrom = r.fromUserId === userId
    const other = iAmFrom ? r.to : r.from
    const myType = (iAmFrom ? r.type : reverseType(r.type as RelationshipType)) as RelationshipType
    const otherIsOlder =
      other.dateOfBirth != null && me?.dateOfBirth != null ? other.dateOfBirth < me.dateOfBirth : false

    return {
      id: r.id,
      direction: iAmFrom ? 'outgoing' : 'incoming',
      other: { id: other.id, publicId: other.publicId, name: other.name },
      type: myType,
      category: r.category,
      status: r.status as RelStatus,
      honorific: kinshipHonorific(myType, other.gender, otherIsOlder),
      guardianApproved: r.guardianApprovedAt !== null,
    }
  })
}

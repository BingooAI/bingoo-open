// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { db } from '@bingoo.ai/db'
import { parseRoles } from '../auth/roles'
import { getAllFacets } from './facet.repo'
import { activitySummary, listRecentEvents } from './events.repo'
import { userSegmentKeys } from './segment.repo'

/**
 * The 360° profile (§3.8) — a READ-MODEL / projection assembled at read time from
 * the core User + the union of enabled facets + relationship signals + the
 * activity stream. It is NOT a table to mutate; write to the underlying facets /
 * events instead. Segments are computed by the P8 analytics module (placeholder).
 */
export async function build360(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      publicId: true,
      name: true,
      email: true,
      image: true,
      role: true,
      status: true,
      accountType: true,
      country: true,
      locale: true,
      timezone: true,
      managedByGuardian: true,
      createdAt: true,
    },
  })
  if (!user) return null

  const [
    facets,
    activity,
    recent,
    classes,
    memberships,
    friends,
    childrenManaged,
    guardians,
    communities,
    segments,
  ] = await Promise.all([
    getAllFacets(userId),
    activitySummary(userId),
    listRecentEvents(userId, 10),
    db.classMember.count({ where: { userId, status: 'active' } }),
    db.member.findMany({
      where: { userId },
      select: { role: true, organization: { select: { id: true, name: true, type: true } } },
    }),
    db.relationship.count({
      where: {
        status: 'confirmed',
        category: 'SOCIAL',
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
    }),
    db.guardianship.count({ where: { guardianId: userId, status: 'active' } }),
    db.guardianship.count({ where: { childId: userId, status: 'active' } }),
    db.communityMember.count({ where: { userId, status: 'active' } }),
    userSegmentKeys(userId),
  ])

  return {
    core: {
      id: user.id,
      publicId: user.publicId,
      name: user.name,
      email: user.email,
      image: user.image,
      roles: parseRoles(user.role),
      status: user.status,
      accountType: user.accountType,
      country: user.country,
      locale: user.locale,
      timezone: user.timezone,
      managedByGuardian: user.managedByGuardian,
      createdAt: user.createdAt,
    },
    facets,
    relations: {
      classes,
      organizations: memberships.map((m) => ({ ...m.organization, role: m.role })),
      friends,
      childrenManaged, // as a guardian
      guardians, // as a child
      communities,
    },
    activity: { ...activity, recent },
    segments, // dynamic cohorts the user belongs to (§3.8)
  }
}

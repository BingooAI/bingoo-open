// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { db } from '@bingoo.ai/db'
import type { Prisma } from '@bingoo.ai/db'
import { evalRule, type SegmentRule } from '@bingoo.ai/core'

/**
 * Dynamic segmentation (§3.8). A Segment holds a typed rule; recompute evaluates
 * it across all users and replaces the UserSegment membership. One user ∈ many
 * segments. This is the transactional seed of the analytics side — a scheduled
 * job (Upstash / warehouse) can drive recompute later; here it runs on demand.
 */

export interface CreateSegmentInput {
  key: string
  name: string
  description?: string | null
  rule: SegmentRule
}

export function createSegment(input: CreateSegmentInput) {
  return db.segment.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      rule: input.rule as unknown as Prisma.InputJsonValue,
    },
  })
}

export function listSegments() {
  return db.segment.findMany({ orderBy: { createdAt: 'desc' } })
}

/** Re-evaluate a segment's rule and replace its membership. Returns the count. */
export async function recomputeSegment(key: string): Promise<number> {
  const segment = await db.segment.findUnique({ where: { key } })
  if (!segment) return 0
  const rule = segment.rule as unknown as SegmentRule

  const [users, childCounts, activity] = await Promise.all([
    db.user.findMany({
      select: { id: true, accountType: true, country: true, role: true, status: true },
    }),
    db.guardianship.groupBy({
      by: ['guardianId'],
      where: { status: 'active' },
      _count: { _all: true },
    }),
    db.activityEvent.groupBy({ by: ['userId'], _max: { createdAt: true } }),
  ])

  const children = new Map(childCounts.map((g) => [g.guardianId, g._count._all]))
  const lastActive = new Map(activity.map((a) => [a.userId, a._max.createdAt]))
  const now = Date.now()

  const matching = users.filter((u) =>
    evalRule(
      rule,
      {
        accountType: u.accountType,
        country: u.country,
        role: u.role,
        status: u.status,
        childrenCount: children.get(u.id) ?? 0,
        lastActive: lastActive.get(u.id) ?? null,
      },
      now,
    ),
  )

  await db.$transaction([
    db.userSegment.deleteMany({ where: { segmentId: segment.id } }),
    db.userSegment.createMany({
      data: matching.map((u) => ({ segmentId: segment.id, userId: u.id })),
    }),
    db.segment.update({ where: { id: segment.id }, data: { computedAt: new Date() } }),
  ])

  return matching.length
}

export async function segmentMembers(key: string) {
  const segment = await db.segment.findUnique({ where: { key }, select: { id: true } })
  if (!segment) return []
  const rows = await db.userSegment.findMany({
    where: { segmentId: segment.id },
    select: { user: { select: { id: true, publicId: true, name: true } } },
  })
  return rows.map((r) => r.user)
}

/** Segment keys a user currently belongs to — surfaced in the 360° (§3.8). */
export async function userSegmentKeys(userId: string): Promise<string[]> {
  const rows = await db.userSegment.findMany({
    where: { userId },
    select: { segment: { select: { key: true } } },
  })
  return rows.map((r) => r.segment.key)
}

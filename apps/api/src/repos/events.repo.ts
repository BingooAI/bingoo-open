import { db } from '@bingoo/db'
import type { Prisma } from '@bingoo/db'

/**
 * Activity/event stream (§3.8) — append-only signals that nourish the 360°
 * projection and (P8) segmentation. Distinct from the audit trail: audit is the
 * security record, events are behavioural signals. Emitting is best-effort — a
 * failure must never break the primary flow.
 */
export async function emitEvent(
  userId: string,
  type: string,
  payload?: Prisma.InputJsonValue,
): Promise<void> {
  try {
    await db.activityEvent.create({
      data: { userId, type, ...(payload !== undefined ? { payload } : {}) },
    })
  } catch (err) {
    console.error(`[event] failed "${type}":`, err instanceof Error ? err.message : err)
  }
}

export function listRecentEvents(userId: string, limit = 10) {
  return db.activityEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, type: true, payload: true, createdAt: true },
  })
}

/** Rolled-up activity signals for the 360° projection. */
export async function activitySummary(userId: string) {
  const [total, last, byType] = await Promise.all([
    db.activityEvent.count({ where: { userId } }),
    db.activityEvent.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    db.activityEvent.groupBy({ by: ['type'], where: { userId }, _count: { _all: true } }),
  ])
  return {
    total,
    lastActiveAt: last?.createdAt ?? null,
    byType: Object.fromEntries(byType.map((g) => [g.type, g._count._all])),
  }
}

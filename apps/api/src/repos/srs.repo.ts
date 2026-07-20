/**
 * Data access lịch ôn SRS (flashcard). Trạng thái per (userId, itemKey).
 * ÔN TẬP ≠ EVIDENCE — bảng này KHÔNG dính SkillState/mastery.
 */

import { db } from '@bingoo/db'
import type { SrsState } from '@bingoo/core'

export async function getSrsState(userId: string, itemKey: string): Promise<SrsState | null> {
  const r = await db.srsCardState.findUnique({
    where: { userId_itemKey: { userId, itemKey } },
    select: { ease: true, intervalDays: true, reps: true, dueDay: true },
  })
  return r ? { ease: r.ease, intervalDays: r.intervalDays, reps: r.reps, dueDay: r.dueDay } : null
}

export async function saveSrsState(userId: string, itemKey: string, s: SrsState): Promise<void> {
  await db.srsCardState.upsert({
    where: { userId_itemKey: { userId, itemKey } },
    create: {
      userId,
      itemKey,
      ease: s.ease,
      intervalDays: s.intervalDays,
      reps: s.reps,
      dueDay: s.dueDay,
    },
    update: { ease: s.ease, intervalDays: s.intervalDays, reps: s.reps, dueDay: s.dueDay },
  })
}

/** itemKey các thẻ tới hạn ôn (dueDay ≤ hôm nay). Thẻ CHƯA có state coi như tới hạn (host xử lý). */
export async function dueCardKeys(userId: string, epochToday: number): Promise<string[]> {
  const rows = await db.srsCardState.findMany({
    where: { userId, dueDay: { lte: epochToday } },
    orderBy: { dueDay: 'asc' },
    select: { itemKey: true },
  })
  return rows.map((r) => r.itemKey)
}

/** itemKey đã có state cho user (để suy ra thẻ mới chưa từng ôn). */
export async function seenCardKeys(userId: string, itemKeys: readonly string[]): Promise<Set<string>> {
  if (itemKeys.length === 0) return new Set()
  const rows = await db.srsCardState.findMany({
    where: { userId, itemKey: { in: [...itemKeys] } },
    select: { itemKey: true },
  })
  return new Set(rows.map((r) => r.itemKey))
}

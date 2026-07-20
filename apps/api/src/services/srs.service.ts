/**
 * Ôn tập flashcard theo SRS (SM-2 của @bingoo/core). ÔN TẬP ≠ EVIDENCE:
 * review chỉ dời lịch ôn, KHÔNG fold vào mastery/SkillState. Date dùng ở host (không phải engine thuần).
 */

import type { AuthoredItem } from '@bingoo/authored-item'
import { epochDay, initSrsState, reviewCard, type SrsGrade, type SrsState } from '@bingoo/core'
import { loadFlashcards } from '../repos/content-item.repo'
import { dueCardKeys, getSrsState, saveSrsState, seenCardKeys } from '../repos/srs.repo'

/** Chấm ôn một thẻ → cập nhật lịch SM-2. Thẻ chưa có state → khởi tạo. */
export async function reviewFlashcard(userId: string, itemKey: string, grade: SrsGrade): Promise<SrsState> {
  const prior = (await getSrsState(userId, itemKey)) ?? initSrsState()
  const next = reviewCard(prior, grade)
  await saveSrsState(userId, itemKey, next)
  return next
}

/** Thẻ tới hạn ôn cho học viên: đã có state & due, HOẶC thẻ mới (chưa từng ôn). Lọc theo skills. */
export async function dueReview(
  userId: string,
  scope?: { skills?: readonly string[] },
): Promise<AuthoredItem[]> {
  const cards = await loadFlashcards(
    scope?.skills && scope.skills.length ? { skills: scope.skills } : undefined,
  )
  if (cards.length === 0) return []
  const dueKeys = new Set(await dueCardKeys(userId, epochDay()))
  const seen = await seenCardKeys(
    userId,
    cards.map((c) => c.itemKey),
  )
  return cards.filter((c) => dueKeys.has(c.itemKey) || !seen.has(c.itemKey))
}

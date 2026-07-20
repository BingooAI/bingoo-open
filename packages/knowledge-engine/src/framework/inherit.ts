/** Di trú SkillState khi chuẩn/node đổi — primitive thuần. SPEC §10. */

import type { Slug } from '../contracts';
import type { SkillMastery } from '../mastery/observe';

/**
 * SPEC §10 — nguyên tắc: KHÔNG đè bằng chứng mới của node kế nhiệm.
 * pKnown/ability chép nguyên; attempts/correct nhân factor (làm tròn). Nếu target đã có
 * state riêng → trả null (GIỮ NGUYÊN, không đè). Dùng cho supersede (factor 1) & split (1/n).
 */
export function inheritState(
  source: SkillMastery,
  existingTarget: SkillMastery | undefined,
  toSlug: Slug,
  factor = 1,
): SkillMastery | null {
  if (existingTarget !== undefined) return null; // đã có state riêng → giữ nguyên
  return {
    skill: toSlug,
    pKnown: source.pKnown,
    ability: source.ability,
    attempts: Math.round(source.attempts * factor),
    correct: Math.round(source.correct * factor),
    lastSeenMs: source.lastSeenMs,
  };
}

/** Hệ số chia đều cho split 1→n. SPEC §10. */
export function splitFactor(n: number): number {
  return n > 0 ? 1 / n : 1;
}

/**
 * SPEC §10 — merge n→1 GIỮ MẠNH nhất: pKnown=max, ability=max, attempts=Σ, correct=Σ.
 * Khác inherit: LUÔN đè target (upsert có update).
 */
export function mergeStates(sources: readonly SkillMastery[], toSlug: Slug): SkillMastery {
  if (sources.length === 0) {
    return { skill: toSlug, pKnown: 0, ability: 1000, attempts: 0, correct: 0, lastSeenMs: null };
  }
  let pKnown = 0;
  let ability = -Infinity;
  let attempts = 0;
  let correct = 0;
  let lastSeenMs: number | null = null;
  for (const s of sources) {
    pKnown = Math.max(pKnown, s.pKnown);
    ability = Math.max(ability, s.ability);
    attempts += s.attempts;
    correct += s.correct;
    if (s.lastSeenMs != null) {
      lastSeenMs = lastSeenMs == null ? s.lastSeenMs : Math.max(lastSeenMs, s.lastSeenMs);
    }
  }
  return { skill: toSlug, pKnown, ability, attempts, correct, lastSeenMs };
}

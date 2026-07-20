/**
 * Máy TRẬN ĐẤU arena — nay là single source trong `@bingoo/core` (thuần, tất định,
 * dùng chung web + native, cạnh quiz-engine). File này chỉ re-export để các view
 * web hiện có tiếp tục `import từ '../arena/engine'` không đổi.
 */
export {
  MAX_ENERGY,
  MAX_HEARTS,
  makeRng,
  initMatch,
  resolveRound,
  specialReady,
  useSpecial,
  type ArenaMode,
  type Difficulty,
  type MatchStatus,
  type Combatant,
  type RoundOutcome,
  type MatchState,
} from '@bingoo/core'

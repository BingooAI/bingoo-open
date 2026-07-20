/**
 * Máy TRẬN ĐẤU arena — thuần, TẤT ĐỊNH, kiểm thử được (không Math.random, không Date). Đây là "lõi"
 * thật của arena: HP · combo · năng lượng · bot đối thủ theo độ khó · điều kiện thắng/thua. View chỉ
 * đọc `MatchState` rồi vẽ; mọi luật trận nằm ở đây (giống tách engine của DevUP).
 *
 *   • vsAI : Bạn ⚔ Trùm AI — hai thanh máu, bot trả lời theo xác suất độ khó.
 *   • coop : Bạn + đồng minh đánh Trùm lớn (máu cao).
 *   • solo : sinh tồn — tim thay máu, sai mất tim, combo nhân điểm.
 *   • practice: học từng câu, không thắng-thua (engine chỉ đếm điểm/combo).
 */

export type ArenaMode = 'practice' | 'coop' | 'solo' | 'vsAI';
export type Difficulty = 'easy' | 'mid' | 'hard';
export type MatchStatus = 'playing' | 'won' | 'lost' | 'done';

export interface Combatant {
  readonly hp: number;
  readonly maxHp: number;
  readonly combo: number;
  /** 0..MAX_ENERGY — đầy thì mở đòn đặc biệt. */
  readonly energy: number;
}

export interface RoundOutcome {
  readonly round: number;
  readonly youCorrect: boolean;
  /** null ở solo/practice (không có đối thủ). */
  readonly foeCorrect: boolean | null;
  readonly youDamage: number;
  readonly foeDamage: number;
  readonly speedBonus: boolean;
}

export interface MatchState {
  readonly mode: ArenaMode;
  readonly difficulty: Difficulty;
  readonly you: Combatant;
  readonly foe: Combatant;
  /** solo dùng tim thay máu. */
  readonly hearts: number;
  readonly round: number;
  readonly totalRounds: number;
  readonly score: number;
  readonly status: MatchStatus;
  readonly log: readonly RoundOutcome[];
}

export const MAX_ENERGY = 4;
export const MAX_HEARTS = 3;
const SPEED_MS = 6000;
const SPEED_BONUS_DMG = 12;

const HP: Record<ArenaMode, { you: number; foe: number }> = {
  vsAI: { you: 100, foe: 100 },
  coop: { you: 100, foe: 150 },
  solo: { you: 0, foe: 0 },
  practice: { you: 0, foe: 0 },
};
const FOE_ACCURACY: Record<Difficulty, number> = { easy: 0.4, mid: 0.6, hard: 0.8 };
const BASE_DAMAGE: Record<ArenaMode, number> = { vsAI: 34, coop: 30, solo: 0, practice: 0 };

/** PRNG tất định (LCG) — bot & test lặp lại được. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const isVersus = (m: ArenaMode) => m === 'vsAI' || m === 'coop';

export function initMatch(opts: {
  mode: ArenaMode;
  difficulty?: Difficulty;
  totalRounds: number;
}): MatchState {
  const hp = HP[opts.mode];
  return {
    mode: opts.mode,
    difficulty: opts.difficulty ?? 'mid',
    you: { hp: hp.you, maxHp: hp.you, combo: 0, energy: 0 },
    foe: { hp: hp.foe, maxHp: hp.foe, combo: 0, energy: 0 },
    hearts: MAX_HEARTS,
    round: 0,
    totalRounds: opts.totalRounds,
    score: 0,
    status: 'playing',
    log: [],
  };
}

/** Người chơi trả lời xong một vòng → trạng thái mới. `rng` quyết bot (mặc định tất định theo vòng). */
export function resolveRound(
  state: MatchState,
  input: { correct: boolean; timeMs?: number },
  rng: () => number = makeRng(state.round + 1),
): MatchState {
  if (state.status !== 'playing') return state;
  const { mode } = state;
  const versus = isVersus(mode);
  const speedBonus = input.correct && (input.timeMs ?? Number.POSITIVE_INFINITY) <= SPEED_MS;
  const foeCorrect = versus ? rng() < FOE_ACCURACY[state.difficulty] : null;

  const youDamage = input.correct ? BASE_DAMAGE[mode] + (speedBonus ? SPEED_BONUS_DMG : 0) : 0;
  const foeDamage = versus && foeCorrect ? Math.round(BASE_DAMAGE[mode] * 0.7) : 0;

  const foeHp = Math.max(0, state.foe.hp - youDamage);
  const youHp = Math.max(0, state.you.hp - foeDamage);
  const hearts = mode === 'solo' && !input.correct ? state.hearts - 1 : state.hearts;
  const combo = input.correct ? state.you.combo + 1 : 0;
  const energy = Math.min(MAX_ENERGY, input.correct ? state.you.energy + 1 : state.you.energy);
  const score = state.score + (input.correct ? 100 + combo * 10 + (speedBonus ? 50 : 0) : 0);
  const round = state.round + 1;

  let status: MatchStatus = 'playing';
  if (versus) {
    if (foeHp <= 0) status = 'won';
    else if (youHp <= 0) status = 'lost';
  } else if (mode === 'solo' && hearts <= 0) {
    status = 'lost';
  }
  if (status === 'playing' && round >= state.totalRounds) {
    status = versus ? (foeHp <= youHp ? 'won' : 'lost') : 'done';
  }

  return {
    ...state,
    you: { ...state.you, hp: youHp, combo, energy },
    foe: { ...state.foe, hp: foeHp },
    hearts,
    round,
    score,
    status,
    log: [
      ...state.log,
      { round, youCorrect: input.correct, foeCorrect, youDamage, foeDamage, speedBonus },
    ],
  };
}

/** Đòn đặc biệt sẵn sàng khi năng lượng đầy. */
export const specialReady = (s: MatchState): boolean => s.you.energy >= MAX_ENERGY;

/** Dùng đòn đặc biệt: xả năng lượng, giáng đòn mạnh (versus) hoặc hồi tim (solo). */
export function useSpecial(state: MatchState): MatchState {
  if (!specialReady(state) || state.status !== 'playing') return state;
  if (isVersus(state.mode)) {
    const foeHp = Math.max(0, state.foe.hp - 40);
    return {
      ...state,
      foe: { ...state.foe, hp: foeHp },
      you: { ...state.you, energy: 0 },
      status: foeHp <= 0 ? 'won' : state.status,
    };
  }
  return {
    ...state,
    hearts: Math.min(MAX_HEARTS, state.hearts + 1),
    you: { ...state.you, energy: 0 },
  };
}

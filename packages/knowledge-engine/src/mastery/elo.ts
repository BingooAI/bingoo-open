/** Elo — trình độ người học & độ khó đối tượng. SPEC §3.3. */

import type { EloParams } from '../policy';

/** Kỳ vọng thắng theo chênh lệch ability−difficulty. SPEC §3.3. */
export function expectedScore(ability: number, difficulty: number, scale: number): number {
  return 1 / (1 + 10 ** ((difficulty - ability) / scale));
}

export interface EloUpdateOpts {
  readonly weight?: number;
}

export interface EloResult {
  readonly ability: number;
  readonly difficulty: number;
}

/**
 * Cập nhật đối xứng: người học và đối tượng dịch NGƯỢC chiều nhau. SPEC §3.3.
 * Không điều chỉnh K theo số lần bên trong; cần thì truyền qua params.
 */
export function eloUpdate(
  ability: number,
  difficulty: number,
  correct: boolean,
  p: EloParams,
  opts: EloUpdateOpts = {},
): EloResult {
  const weight = opts.weight ?? 1;
  const exp = expectedScore(ability, difficulty, p.scale);
  const outcome = correct ? 1 : 0;
  const surprise = (outcome - exp) * weight;
  return {
    ability: ability + p.kLearner * surprise,
    difficulty: difficulty - p.kItem * surprise, // đối tượng dịch ngược
  };
}

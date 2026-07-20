/** Rasch / 1PL — quy đổi Elo ↔ logit. SPEC §12. */

/** SPEC §12 — θ người học từ Elo (tâm base, ELO_PER_LOGIT). */
export function thetaFromElo(elo: number, base: number, eloPerLogit: number): number {
  return (elo - base) / eloPerLogit
}

/** SPEC §12 — β độ khó đề từ Elo (cùng công thức θ). */
export function betaFromElo(elo: number, base: number, eloPerLogit: number): number {
  return (elo - base) / eloPerLogit
}

/** SPEC §12 — ICC 1PL/Rasch: P(đúng) theo chênh lệch θ−β. */
export function pCorrectRasch(theta: number, beta: number): number {
  return 1 / (1 + Math.exp(-(theta - beta)))
}

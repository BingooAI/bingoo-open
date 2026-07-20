import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POLICY,
  betaPosterior,
  bktForget,
  eloUpdate,
  interpolateConfidence,
  scoreRubric,
} from '../../src/index';

/** SPEC Phụ lục C.2 — nguyên hàm thuần. */

const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;
const { bkt, elo, beta, confidence } = DEFAULT_POLICY;

describe('C.2 bktForget', () => {
  it('0.9 sau 10 ngày = 0.6637', () => {
    expect(r4(bktForget(0.9, 10, bkt))).toBe(0.6637);
  });
  it('0.9 sau 0 ngày = 0.9', () => {
    expect(r4(bktForget(0.9, 0, bkt))).toBe(0.9);
  });
});

describe('C.2 eloUpdate', () => {
  it('(1000,1000,correct) = {1016, 996}', () => {
    const r = eloUpdate(1000, 1000, true, elo);
    expect([r4(r.ability), r4(r.difficulty)]).toEqual([1016, 996]);
  });
  it('(1000,1200,correct) = {1024.3119, 1193.9220}', () => {
    const r = eloUpdate(1000, 1200, true, elo);
    expect([r4(r.ability), r4(r.difficulty)]).toEqual([1024.3119, 1193.922]);
  });
  it('(1000,1000,wrong) = {984, 1004}', () => {
    const r = eloUpdate(1000, 1000, false, elo);
    expect([r4(r.ability), r4(r.difficulty)]).toEqual([984, 1004]);
  });
});

describe('C.2 scoreRubric', () => {
  it('[{3/4,w2},{1/2,w1}] = {0.6667, 0.7}', () => {
    const r = scoreRubric([
      { score: 3, max: 4, weight: 2 },
      { score: 1, max: 2, weight: 1 },
    ]);
    expect([r4(r.outcome), r4(r.confidence)]).toEqual([0.6667, 0.7]);
  });
  it('[{1/0}] = {0, 0}', () => {
    const r = scoreRubric([{ score: 1, max: 0 }]);
    expect([r.outcome, r.confidence]).toEqual([0, 0]);
  });
});

describe('C.2 betaPosterior', () => {
  it('(3,1) = {0.6667, 0.3174, 1.0000}', () => {
    const r = betaPosterior(3, 1, beta);
    expect([r4(r.mean), r4(r.lo), r4(r.hi)]).toEqual([0.6667, 0.3174, 1.0]);
  });
  it('(8,2) = {0.7500, 0.5146, 0.9854}', () => {
    const r = betaPosterior(8, 2, beta);
    expect([r4(r.mean), r4(r.lo), r4(r.hi)]).toEqual([0.75, 0.5146, 0.9854]);
  });
  it('(0,0) = {0.5000, 0.0000, 1.0000}', () => {
    const r = betaPosterior(0, 0, beta);
    expect([r4(r.mean), r4(r.lo), r4(r.hi)]).toEqual([0.5, 0.0, 1.0]);
  });
});

describe('C.2 interpolateConfidence', () => {
  it('{rater 1} = 1.000', () => {
    expect(r4(interpolateConfidence({ rater: 1 }, confidence))).toBe(1.0);
  });
  it('{rater 1, latency 40k, expected 15k} = 0.850', () => {
    expect(
      r4(interpolateConfidence({ rater: 1, latencyMs: 40_000, expectedMs: 15_000 }, confidence)),
    ).toBe(0.85);
  });
  it('{rater 1, hints 2} = 0.700', () => {
    expect(r4(interpolateConfidence({ rater: 1, hintsUsed: 2 }, confidence))).toBe(0.7);
  });
  it('{rater 1, latency 40k, expected 15k, hints 2} = 0.595', () => {
    expect(
      r4(
        interpolateConfidence(
          { rater: 1, latencyMs: 40_000, expectedMs: 15_000, hintsUsed: 2 },
          confidence,
        ),
      ),
    ).toBe(0.595);
  });
});

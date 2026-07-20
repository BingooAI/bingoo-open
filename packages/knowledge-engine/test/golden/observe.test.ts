import { describe, expect, it } from 'vitest';
import { DAY_MS, DEFAULT_POLICY, freshMastery, observe, type ObserveParams } from '../../src/index';

/** SPEC Phụ lục C.1 — fold một chuỗi quan sát (BKT+Elo). Khớp từng số, 4 chữ số. */

const params: ObserveParams = { bkt: DEFAULT_POLICY.bkt, elo: DEFAULT_POLICY.elo };
const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;

describe('C.1 observe()', () => {
  it('6× correct liên tiếp', () => {
    const expected: Array<[number, number]> = [
      [0.672, 1016],
      [0.9198, 1032],
      [0.9844, 1048],
      [0.9971, 1064],
      [0.9995, 1080],
      [0.9999, 1096],
    ];
    let m = freshMastery('s', params.bkt.pInit);
    for (const [pKnown, ability] of expected) {
      m = observe(m, { skill: 's', correct: true }, params);
      expect(r4(m.pKnown)).toBe(pKnown);
      expect(r4(m.ability)).toBe(ability);
    }
  });

  it('mixed [T,F,T,T]', () => {
    const seq: Array<[boolean, number, number]> = [
      [true, 0.672, 1016],
      [false, 0.3472, 1000],
      [true, 0.7583, 1016],
      [true, 0.9458, 1032],
    ];
    let m = freshMastery('s', params.bkt.pInit);
    for (const [correct, pKnown, ability] of seq) {
      m = observe(m, { skill: 's', correct }, params);
      expect(r4(m.pKnown)).toBe(pKnown);
      expect(r4(m.ability)).toBe(ability);
    }
  });

  it('có khoảng cách (quên): correct@t0 → correct@+30 ngày', () => {
    const t0 = 1000;
    let m = freshMastery('s', params.bkt.pInit);
    m = observe(m, { skill: 's', correct: true, atMs: t0 }, params);
    expect(r4(m.pKnown)).toBe(0.672);
    expect(r4(m.ability)).toBe(1016);

    m = observe(m, { skill: 's', correct: true, atMs: t0 + 30 * DAY_MS }, params);
    expect(r4(m.pKnown)).toBe(0.6917);
    expect(r4(m.ability)).toBe(1032);
  });

  it('difficulty=1200 (trên ability), weight=0.6, correct', () => {
    const m0 = freshMastery('s', params.bkt.pInit);
    const m = observe(m0, { skill: 's', correct: true, difficulty: 1200, weight: 0.6 }, params);
    expect(r4(m.pKnown)).toBe(0.5572);
    expect(r4(m.ability)).toBe(1014.5871);
  });
});

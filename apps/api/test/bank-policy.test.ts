/**
 * Chính sách độ dày rich-bank — ma trận ĐÍCH (rep×band×misconception) + coverage đối chiếu bank. Thuần.
 * Khoá: "rich CÓ CHỦ ĐÍCH" (số bản theo richness, misconception mỗi cái 1 ô) + gap đúng chỗ thiếu.
 */

import { describe, expect, it } from 'vitest';
import {
  bankCoverage,
  bankDensityPolicy,
  bankTargetTotal,
  bandOfElo,
  coverageGapTotal,
} from '../src/services/bank-policy';

describe('bankDensityPolicy', () => {
  it('mặc định: 3 rep × 3 band × standard(2) = 18 ô lưới, + 1 ô/misconception', () => {
    const slots = bankDensityPolicy({ misconceptions: [{ id: 'm1' }, { id: 'm2' }] });
    const grid = slots.filter((s) => !s.misconceptionId);
    const diag = slots.filter((s) => s.misconceptionId);
    expect(grid).toHaveLength(9); // 3×3
    expect(grid.every((s) => s.count === 2)).toBe(true);
    expect(bankTargetTotal(grid)).toBe(18);
    expect(diag.map((s) => s.misconceptionId)).toEqual(['m1', 'm2']);
    expect(diag.every((s) => s.count === 1)).toBe(true);
  });

  it('giới hạn representation + richness "rich"(3) → ít ô hơn, dày hơn', () => {
    const slots = bankDensityPolicy({
      representations: ['pictorial'],
      bands: ['core'],
      richness: 'rich',
    });
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ representation: 'pictorial', band: 'core', count: 3 });
  });

  it('lean(1) < standard(2) < rich(3) mỗi ô', () => {
    const per = (r: 'lean' | 'standard' | 'rich') =>
      bankDensityPolicy({ representations: ['concrete'], bands: ['easy'], richness: r })[0]!.count;
    expect(per('lean')).toBe(1);
    expect(per('standard')).toBe(2);
    expect(per('rich')).toBe(3);
  });
});

describe('bandOfElo', () => {
  it('1300→easy, 1500→core, 1700→stretch (biên 1400/1600)', () => {
    expect(bandOfElo(1300)).toBe('easy');
    expect(bandOfElo(1400)).toBe('easy');
    expect(bandOfElo(1500)).toBe('core');
    expect(bandOfElo(1600)).toBe('stretch');
    expect(bandOfElo(1700)).toBe('stretch');
  });
});

describe('bankCoverage', () => {
  const target = bankDensityPolicy({
    representations: ['pictorial'],
    bands: ['core'],
    misconceptions: [{ id: 'm1' }],
    richness: 'standard', // ô lưới cần 2
  });

  it('bank có 1 item pictorial/core → ô lưới have=1 need=1; ô misconception have=0 need=1', () => {
    const rows = bankCoverage([{ representation: 'pictorial', band: 'core' }], target);
    const grid = rows.find((r) => !r.slot.misconceptionId)!;
    const diag = rows.find((r) => r.slot.misconceptionId === 'm1')!;
    expect(grid).toMatchObject({ have: 1, need: 1 });
    expect(diag).toMatchObject({ have: 0, need: 1 });
    expect(coverageGapTotal(rows)).toBe(2); // 1 (lưới) + 1 (misconception)
  });

  it('item chẩn đoán đóng dấu misconceptionId → khớp ô chẩn đoán, KHÔNG khớp ô lưới', () => {
    const rows = bankCoverage(
      [{ misconceptionId: 'm1', representation: 'pictorial', band: 'core' }],
      target,
    );
    // item này có cả rep/band nhưng khớp ô chẩn đoán trước; ô lưới vẫn thiếu đủ 2
    expect(rows.find((r) => r.slot.misconceptionId === 'm1')).toMatchObject({ have: 1, need: 0 });
  });

  it('item chưa đóng dấu facets → không tính vào ô nào', () => {
    const rows = bankCoverage([{}], target);
    expect(coverageGapTotal(rows)).toBe(bankTargetTotal(target)); // vẫn thiếu toàn bộ
  });
});

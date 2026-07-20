/**
 * ĐỐI CHIẾU bằng CẤU TRÚC — tất định, miễn phí, không LLM.
 * Mỗi test canh một lớp lỗi đã xảy ra thật khi đối chiếu Cambridge ↔ Bộ GD&ĐT.
 */

import { describe, expect, it } from 'vitest';
import type { DomainProfile } from '@bingoo/facets';
import {
  compareScope,
  proposeAlignment,
  requiresHuman,
  structuralVerdict,
  type ExistingKc,
  type NewConcept,
} from '../src/index';

const math: DomainProfile = { domain: 'math', requiredAxes: ['object'] };

describe('compareScope — cơ học, không LLM, không ngưỡng', () => {
  it('within 20 ⊂ within 100', () => {
    expect(compareScope({ max: 20 }, { max: 100 })).toBe('subset');
  });
  it('within 100 ⊃ within 20', () => {
    expect(compareScope({ max: 100 }, { max: 20 })).toBe('superset');
  });
  it('bằng nhau', () => {
    expect(compareScope({ max: 20 }, { max: 20 })).toBe('equal');
  });
  it('lệch hai chiều → không bao nhau', () => {
    expect(compareScope({ max: 100, min: 5 }, { max: 20, min: 0 })).toBe('incomparable');
  });
  it('khác bộ khoá → không bao nhau (không được đoán bừa)', () => {
    expect(compareScope({ max: 20 }, { digits: 2 })).toBe('incomparable');
  });
  it('thiếu scope một bên → không bao nhau', () => {
    expect(compareScope(undefined, { max: 20 })).toBe('incomparable');
  });
});

describe('structuralVerdict', () => {
  it('khác object → NEW (không LLM, không tốn tiền)', () => {
    const d = structuralVerdict({ object: 'parity' }, { object: 'addition' }, math);
    expect(d.verdict).toBe('NEW');
    expect(d.decidedBy).toBe('structure');
  });

  // ĐÂY là giá trị cốt lõi: Cambridge "đếm trong 20" và Bộ GD&ĐT "đếm trong 100" KHÔNG được gộp,
  // cũng không phải hai thứ rời rạc — chúng là hai KC có quan hệ TIÊN QUYẾT.
  it('cùng object, scope bao nhau → SUBSET/SUPERSET (sinh cạnh TIÊN QUYẾT)', () => {
    expect(
      structuralVerdict(
        { object: 'counting', scope: { max: 20 } },
        { object: 'counting', scope: { max: 100 } },
        math,
      ).verdict,
    ).toBe('SUBSET');
    expect(
      structuralVerdict(
        { object: 'counting', scope: { max: 100 } },
        { object: 'counting', scope: { max: 20 } },
        math,
      ).verdict,
    ).toBe('SUPERSET');
  });

  // LỚP LỖI #10 — hồi quy: nhiễu ở trục MÔ TẢ từng hạ SUBSET xuống OVERLAP → 9/10 vô dụng.
  it('nhiễu ở trục MÔ TẢ (channel/bloom) KHÔNG được giết suy luận bao hàm', () => {
    const d = structuralVerdict(
      { object: 'counting', scope: { max: 20 }, channel: 'say', bloom: 'recall' },
      { object: 'counting', scope: { max: 100 }, channel: 'write', bloom: 'apply' },
      math,
    );
    expect(d.verdict).toBe('SUBSET');
  });

  it('trùng khít → SAME (ứng viên gộp, nhưng phải qua người)', () => {
    const f = { object: 'addition', scope: { max: 20 } } as const;
    const d = structuralVerdict(f, { ...f }, math);
    expect(d.verdict).toBe('SAME');
    expect(requiresHuman(d.verdict)).toBe(true);
  });

  it('thiếu facet một bên → UNKNOWN (mới là lúc đáng gọi LLM)', () => {
    expect(structuralVerdict({ object: 'addition' }, undefined, math).verdict).toBe('UNKNOWN');
    expect(structuralVerdict({}, { object: 'addition' }, math).verdict).toBe('UNKNOWN');
  });
});

describe('requiresHuman — mặc định của hệ thống là KHÔNG GỘP', () => {
  it('mọi phán quyết dẫn tới gộp hoặc còn mờ đều phải qua người', () => {
    expect(requiresHuman('SAME')).toBe(true);
    expect(requiresHuman('UNKNOWN')).toBe(true);
    expect(requiresHuman('OVERLAP')).toBe(true);
  });
  it('phán quyết KHÔNG gộp gì thì an toàn, máy tự đi tiếp', () => {
    expect(requiresHuman('NEW')).toBe(false);
    expect(requiresHuman('SUBSET')).toBe(false);
    expect(requiresHuman('SUPERSET')).toBe(false);
  });
});

// LỚP LỖI #1 (chí mạng): đề xuất KHÔNG mang slug/kind/facets → UI tự chế slug ở client và ghi KC
// KHÔNG CÓ FACET. KC vô danh thì mọi lần đối chiếu sau đều mù, và I8 bị vi phạm ngay khi ghi.
describe('proposeAlignment mang đủ slug/kind/facets sang tầng ghi', () => {
  const next: NewConcept = {
    tempId: 'c1',
    title: 'Count within 20',
    kind: 'SKILL',
    subject: 'math',
    facets: { object: 'counting', scope: { max: 20 } },
  };

  it('không có ứng viên → NEW, và VẪN mang đủ facets/kind/slug', () => {
    const p = proposeAlignment(next, undefined, 'count-within-20', math);
    expect(p.decision.verdict).toBe('NEW');
    expect(p.slug).toBe('count-within-20');
    expect(p.kind).toBe('SKILL');
    expect(p.subject).toBe('math');
    expect(p.facets).toEqual({ object: 'counting', scope: { max: 20 } });
    expect(p.needsHuman).toBe(false);
  });

  it('có ứng viên → giữ nguyên facets, và slug là do SERVER cấp (client không được tự chế)', () => {
    const existing: ExistingKc = {
      slug: 'count-within-100',
      title: 'Count within 100',
      subject: 'math',
      facets: { object: 'counting', scope: { max: 100 } },
    };
    const p = proposeAlignment(next, existing, 'count-within-20', math);
    expect(p.decision.verdict).toBe('SUBSET');
    expect(p.target).toBe('count-within-100');
    expect(p.slug).toBe('count-within-20');
    expect(p.facets).toBeDefined();
  });
});

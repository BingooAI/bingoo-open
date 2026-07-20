/**
 * resolveDescriptor + blueprints — canh cửa vào chính của host: cấu hình lỏng → đầy đủ, và mọi
 * blueprint đặt sẵn phải KHÔNG mâu thuẫn cứng (sai một cái là lỗi phát ra tận UI người học).
 */

import { describe, expect, it } from 'vitest';
import {
  BLUEPRINTS,
  DEFAULT_DESCRIPTOR,
  descriptorKey,
  getBlueprint,
  isValid,
  matchBlueprint,
  parseDescriptor,
  resolveDescriptor,
} from '../src/index';

describe('resolveDescriptor', () => {
  it('điền trục trống bằng mặc định', () => {
    const r = resolveDescriptor({ experience: 'practice' });
    expect(r.descriptor).toEqual({ ...DEFAULT_DESCRIPTOR, experience: 'practice' });
    expect(r.compatibility.verdict).toBe('VALID');
  });

  it('nhận base tuỳ biến để điền', () => {
    const r = resolveDescriptor(
      { time: 'scheduled' },
      {
        experience: 'learn',
        delivery: 'classroom',
        companion: 'teacher',
        scale: 'class',
        time: 'on-demand',
      },
    );
    expect(r.descriptor.delivery).toBe('classroom');
    expect(r.descriptor.time).toBe('scheduled');
    expect(r.blueprint?.id).toBe('virtual-classroom');
  });

  it('KHÔNG âm thầm sửa mâu thuẫn — phản ánh đúng INVALID', () => {
    const r = resolveDescriptor({ scale: 'solo', companion: 'teacher' });
    expect(r.descriptor.companion).toBe('teacher');
    expect(r.compatibility.verdict).toBe('INVALID');
  });

  it('gắn kèm năng lực suy ra', () => {
    expect(resolveDescriptor({}).capabilities).toEqual(['lesson-runtime', 'ai-tutor']);
  });
});

describe('blueprints', () => {
  it('mọi blueprint không mâu thuẫn cứng (isValid)', () => {
    for (const b of BLUEPRINTS) {
      expect(isValid(b.descriptor), `blueprint ${b.id} phải hợp lệ`).toBe(true);
    }
  });

  it('id blueprint là duy nhất', () => {
    const ids = BLUEPRINTS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('descriptor blueprint là duy nhất (không hai công thức trùng điểm)', () => {
    const keys = BLUEPRINTS.map((b) => descriptorKey(b.descriptor));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('matchBlueprint tìm đúng công thức theo điểm 5 trục', () => {
    const b = getBlueprint('live-arena');
    expect(b).toBeDefined();
    if (b) expect(matchBlueprint(b.descriptor)?.id).toBe('live-arena');
  });

  it('matchBlueprint trả undefined cho điểm không đặt sẵn', () => {
    expect(
      matchBlueprint({
        experience: 'project',
        delivery: 'live',
        companion: 'mentor',
        scale: 'group',
        time: 'live',
      }),
    ).toBeUndefined();
  });
});

describe('parseDescriptor', () => {
  it('nhận dữ liệu hợp lệ', () => {
    expect(parseDescriptor(DEFAULT_DESCRIPTOR)).toEqual(DEFAULT_DESCRIPTOR);
  });

  it('loại dữ liệu sai (không ném, trả undefined)', () => {
    expect(parseDescriptor({ experience: 'lecture' })).toBeUndefined();
    expect(parseDescriptor(null)).toBeUndefined();
    expect(parseDescriptor({ ...DEFAULT_DESCRIPTOR, scale: 'huge' })).toBeUndefined();
  });
});

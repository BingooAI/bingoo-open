/**
 * KC lấy MẠCH từ objective map vào nó — không dùng strand thô đoán bừa trên KC.
 * Cùng luật với `stage`: nhãn của khung sống trên OBJECTIVE, KC suy ra qua MAPS_TO.
 */

import { describe, expect, it } from 'vitest';
import { deriveKcStrands } from '../src/repos/strand';

describe('deriveKcStrands', () => {
  it('KC lấy strand của objective map vào nó (thay cho "number" thô)', () => {
    const objs = [
      { id: 'o1', strand: 'Counting and sequences' },
      { id: 'o2', strand: 'Integers and powers' },
    ];
    const map = deriveKcStrands(objs, [
      { fromId: 'o1', toId: 'kc-count' },
      { fromId: 'o2', toId: 'kc-add' },
    ]);
    expect(map.get('kc-count')).toBe('Counting and sequences');
    expect(map.get('kc-add')).toBe('Integers and powers');
  });

  it('KC được nhiều objective map vào → chọn mạch PHỔ BIẾN NHẤT', () => {
    const objs = [
      { id: 'o1', strand: 'Counting and sequences' },
      { id: 'o2', strand: 'Counting and sequences' },
      { id: 'o3', strand: 'Money' },
    ];
    const map = deriveKcStrands(objs, [
      { fromId: 'o1', toId: 'kc' },
      { fromId: 'o2', toId: 'kc' },
      { fromId: 'o3', toId: 'kc' },
    ]);
    expect(map.get('kc')).toBe('Counting and sequences');
  });

  it('hoà phiếu → tất định theo alphabet (2 lần dựng ra cùng nhóm)', () => {
    const objs = [
      { id: 'o1', strand: 'Money' },
      { id: 'o2', strand: 'Counting and sequences' },
    ];
    const map = deriveKcStrands(objs, [
      { fromId: 'o1', toId: 'kc' },
      { fromId: 'o2', toId: 'kc' },
    ]);
    // 'Counting…' < 'Money' theo alphabet → thắng, bất kể thứ tự đầu vào
    expect(map.get('kc')).toBe('Counting and sequences');
  });

  it('objective không có strand → bỏ qua, không đếm', () => {
    const objs = [
      { id: 'o1', strand: null },
      { id: 'o2', strand: '  ' },
      { id: 'o3', strand: 'Money' },
    ];
    const map = deriveKcStrands(objs, [
      { fromId: 'o1', toId: 'kc' },
      { fromId: 'o2', toId: 'kc' },
      { fromId: 'o3', toId: 'kc' },
    ]);
    expect(map.get('kc')).toBe('Money');
  });

  it('KC không objective nào map vào → vắng mặt (không bịa mạch)', () => {
    const map = deriveKcStrands([{ id: 'o1', strand: 'Money' }], []);
    expect(map.has('kc')).toBe(false);
    expect(map.size).toBe(0);
  });
});

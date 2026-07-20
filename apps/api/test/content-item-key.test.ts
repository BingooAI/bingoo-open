/**
 * contentItemKey — định dạng itemKey scope theo BƯỚC: `kc::stepSlug::kind::seq`. Khoá cái bug "duyệt 1
 * item mà nhiều bước cùng KC hiện đã duyệt": item của bước A KHÔNG được khớp prefix của bước B.
 */

import { describe, expect, it } from 'vitest';
import { contentItemKey } from '../src/services/content-item-gen.service';

describe('contentItemKey', () => {
  it('có stepSlug → key 4 phần kc::step::kind::seq', () => {
    expect(contentItemKey('count-to-10', 'manip:count', 0, 'hook')).toBe(
      'count-to-10::hook::manip:count::0',
    );
  });

  it('không stepSlug → key cũ 3 phần (tương thích)', () => {
    expect(contentItemKey('count-to-10', 'single', 2)).toBe('count-to-10::single::2');
  });

  it('hai bước CÙNG KC + CÙNG loại → prefix bước KHÁC nhau, KHÔNG leak chéo', () => {
    const kc = 'count-to-10';
    const a = contentItemKey(kc, 'manip:count', 0, 'hook');
    const b = contentItemKey(kc, 'manip:count', 0, 'teach');
    const prefixHook = `${kc}::hook::`;
    const prefixTeach = `${kc}::teach::`;
    expect(a.startsWith(prefixHook)).toBe(true);
    expect(a.startsWith(prefixTeach)).toBe(false); // item bước hook KHÔNG lọt vào bước teach
    expect(b.startsWith(prefixTeach)).toBe(true);
    expect(b.startsWith(prefixHook)).toBe(false);
  });

  it('key cũ 3 phần KHÔNG khớp prefix bước (cutover sạch)', () => {
    const legacy = contentItemKey('count-to-10', 'manip:count', 0); // 'count-to-10::manip:count::0'
    expect(legacy.startsWith('count-to-10::hook::')).toBe(false);
  });
});

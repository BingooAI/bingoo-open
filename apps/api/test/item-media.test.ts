/**
 * itemMediaSlots — dẫn xuất ô media per-item. Khoá 2 điều dễ lệch (chạy offline):
 *  · kit ảnh-vật → ô "Ảnh cho vật" ghi URL vào ĐÚNG khoá `params.assets.<shape>` mà render đọc, query
 *    ép 1 VẬT ĐƠN LẺ (không cả cảnh) từ objectLabel.
 *  · quiz thường → ô minh hoạ (assetId) + đọc đề; mỗi đáp án → ô ảnh + đọc.
 */

import { describe, expect, it } from 'vitest'
import { itemMediaSlots } from '../src/services/item-media.service'

describe('itemMediaSlots', () => {
  it('kit ảnh-vật (count) → ô "Ảnh cho vật" đúng khoá shape + query 1 vật đơn lẻ', () => {
    const slots = itemMediaSlots({
      primitiveKind: 'manip:count',
      payload: {
        params: { shape: 'star', count: 0 },
        objectLabel: { vi: 'chiếc ô tô đồ chơi', en: 'toy car' },
        prompt: { vi: 'Đếm số ô tô' },
      },
    })
    const obj = slots.find((s) => s.slot === 'kit-object')
    expect(obj).toBeDefined()
    expect(obj!.path).toBe('params.assets.star') // đúng khoá render đọc (P.assets[P.shape])
    expect(obj!.asUrl).toBe(true) // kit render cần URL
    expect(obj!.query).toMatch(/A single toy car/)
    expect(obj!.query).toMatch(/one object only/)
    expect(obj!.label.vi).toContain('chiếc ô tô đồ chơi')
  })

  it('kit ảnh-vật đã gắn URL → current phản ánh assets[shape]', () => {
    const slots = itemMediaSlots({
      primitiveKind: 'manip:count',
      payload: {
        params: { shape: 'apple', count: 0, assets: { apple: 'https://x/y.png' } },
        objectLabel: { en: 'apple' },
      },
    })
    expect(slots.find((s) => s.slot === 'kit-object')!.current).toBe('https://x/y.png')
  })

  it('kit KHÔNG ảnh-vật (numberline) → không có ô kit-object', () => {
    const slots = itemMediaSlots({
      primitiveKind: 'manip:numberline',
      payload: { params: { shape: 'x' }, prompt: { vi: 'Đặt số' } },
    })
    expect(slots.some((s) => s.slot === 'kit-object')).toBe(false)
  })

  it('quiz thường → ảnh minh hoạ (assetId) + đọc đề + ô mỗi đáp án', () => {
    const slots = itemMediaSlots({
      primitiveKind: 'single',
      payload: {
        prompt: { vi: '2 + 3 = ?' },
        choices: [{ label: '5' }, { label: '6' }],
      },
    })
    const illus = slots.find((s) => s.slot === 'illustration')
    expect(illus).toBeDefined()
    expect(illus!.asUrl).toBe(false) // quiz lưu assetId, không URL
    expect(illus!.path).toBe('imageAssetId')
    expect(slots.some((s) => s.slot === 'prompt-audio')).toBe(true)
    expect(slots.filter((s) => s.slot === 'choice-image')).toHaveLength(2)
    expect(slots.filter((s) => s.slot === 'choice-audio')).toHaveLength(2)
    expect(slots.find((s) => s.slot === 'choice-image')!.path).toBe('choices[0].imageAssetId')
  })
})

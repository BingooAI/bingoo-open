// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * CỬA SỔ CHỮ CỦA MỘT CHƯƠNG.
 *
 * Trước đây "đọc được bao nhiêu sách" và "đưa bao nhiêu chữ cho một lượt sinh" là cùng một con số.
 * Đo trên cuốn 266 trang: 26 chương mà chỉ 13 bài — các chương cuối không có chữ nào để tìm bài
 * trong đó. Tách hai con số ra thì đọc sâu được, mà mỗi lượt gọi vẫn nhỏ.
 */

import { describe, expect, it } from 'vitest'
import { unitWindow } from '../src/services/course-shell.service'

const book = `${'A'.repeat(1000)} Chương 3: Phân số ${'B'.repeat(1000)}`

describe('cắt phần sách của một chương', () => {
  it('tìm theo nhan đề chương', () => {
    expect(unitWindow(book, 'Phân số', '').startsWith('Phân số')).toBe(true)
  })

  it('nhãn sách được ưu tiên hơn nhan đề', () => {
    expect(unitWindow(book, 'Phân số', 'Chương 3').startsWith('Chương 3')).toBe(true)
  })

  it('không tìm thấy → trả PHẦN ĐẦU, không trả cả cuốn', () => {
    // Trả cả cuốn thì lượt sinh lại chạm trần token — đúng thứ vừa phải cắt việc để tránh.
    const w = unitWindow(book, 'Chương không tồn tại', '')
    expect(w.startsWith('AAA')).toBe(true)
    expect(w.length).toBeLessThanOrEqual(book.length)
  })

  it('nhan đề quá ngắn thì không dùng để dò — dễ khớp nhầm khắp nơi', () => {
    expect(unitWindow(book, 'A', '').startsWith('AAA')).toBe(true)
  })
})

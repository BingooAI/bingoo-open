// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * KIỂM CÂU TRÍCH — làn bằng chứng người duyệt tự soi được. Nguồn dùng ở đây là bản TỰ SOẠN
 * (không trích nguyên văn tài liệu bên thứ ba — §1), chỉ để chứng minh cơ chế.
 *
 * Có bài CANARY: lấy một câu ĐÃ khớp, bôi hỏng một chữ → phải chuyển sang `not_found`. Nếu bài
 * này không đỏ khi ta cố tình phá, cả làn "từ tài liệu" là vô nghĩa.
 */

import { describe, expect, it } from 'vitest'
import { normalizeSource, verifyQuote } from '../src/index'

// Nguồn tự soạn, giọng như một khung Số Lớp 1 (KHÔNG phải Thông tư nguyên văn).
const SOURCE = `SỐ VÀ PHÉP TÍNH — LỚP 1

Đếm, đọc, viết các số trong phạm vi 10; 20; 100.
Nhận biết chục và đơn vị của một số có hai chữ số.
So sánh và sắp thứ tự các số trong phạm vi 100.
Cộng và trừ (không nhớ) trong phạm vi 100.`

describe('verifyQuote — khớp nguyên văn', () => {
  it('tìm thấy một câu mục tiêu nguyên văn → verified + offset đúng', () => {
    const q = 'Đếm, đọc, viết các số trong phạm vi 10; 20; 100.'
    const m = verifyQuote(q, SOURCE)
    expect(m.status).toBe('verified')
    // offset trỏ vào nguồn ĐÃ chuẩn hoá và cắt ra đúng câu.
    const norm = normalizeSource(SOURCE)
    expect(norm.slice(m.charStart, m.charEnd)).toBe(q)
  })

  it('dung sai khoảng trắng thừa và xuống dòng giữa câu', () => {
    const q = 'So sánh   và sắp thứ tự\n các số trong phạm vi 100'
    expect(verifyQuote(q, SOURCE).status).toBe('verified')
  })

  it('dung sai nháy cong và gạch dài (bản OCR hay đổi)', () => {
    const src = 'Trẻ học phép cộng — không nhớ — trong phạm vi 20 ở học kỳ một.'
    const q = 'phép cộng - không nhớ - trong phạm vi 20'
    expect(verifyQuote(q, src).status).toBe('verified')
  })

  it('dung sai NFC vs tổ hợp dấu (cùng chữ, mã khác)', () => {
    const composed = 'Nhận biết chục và đơn vị'
    // cùng nội dung nhưng để dạng NFD (dấu tách rời)
    const decomposedSrc = `... ${composed.normalize('NFD')} ...`
    expect(verifyQuote(composed, decomposedSrc).status).toBe('verified')
  })
})

describe('verifyQuote — từ chối trung thực', () => {
  it('câu AI bịa, không có trong nguồn → not_found', () => {
    const q = 'Nhân và chia các số trong phạm vi 1000.'
    expect(verifyQuote(q, SOURCE).status).toBe('not_found')
  })

  it('một từ lẻ thường gặp KHÔNG được earn "từ tài liệu" → too_short', () => {
    expect(verifyQuote('Đếm', SOURCE).status).toBe('too_short')
    expect(verifyQuote('Số', SOURCE).status).toBe('too_short')
  })

  it('tiêu đề cụt cũng quá tầm thường → too_short', () => {
    expect(verifyQuote('Lớp 1', SOURCE).status).toBe('too_short')
  })
})

describe('verifyQuote — CANARY (cố tình phá cho đỏ)', () => {
  it('câu đã khớp, bôi hỏng một chữ → phải rớt xuống not_found', () => {
    const good = 'Cộng và trừ (không nhớ) trong phạm vi 100.'
    expect(verifyQuote(good, SOURCE).status).toBe('verified')

    const tampered = good.replace('phạm vi 100', 'phạm vi 1000')
    expect(verifyQuote(tampered, SOURCE).status).toBe('not_found')
  })

  it('nguồn bị đục mất câu → câu trích cũ không còn khớp', () => {
    const good = 'So sánh và sắp thứ tự các số trong phạm vi 100.'
    expect(verifyQuote(good, SOURCE).status).toBe('verified')

    const gutted = SOURCE.replace('So sánh và sắp thứ tự các số trong phạm vi 100.', '')
    expect(verifyQuote(good, gutted).status).toBe('not_found')
  })
})

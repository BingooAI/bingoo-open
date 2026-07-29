// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * SINH LẠI MỘT VỎ KHOÁ ĐÃ DUYỆT — chỗ con dấu duyệt từng sống sót qua việc thay sạch nội dung.
 *
 * Slug do model đặt từ nhan đề, nên hai lần sinh gần giống nhau ra CÙNG một slug và lần sau đè lên
 * lần trước. Trạng thái thì đứng nguyên, nên một vỏ khoá chưa ai đọc mang con dấu của người đã đọc
 * một thứ khác hẳn — đúng điều mà luật "người duyệt thứ trẻ thấy" tồn tại để chặn. Đã đo được trên
 * kho thật trước khi sửa: nội dung thay hoàn toàn, trạng thái vẫn APPROVED.
 */

import { describe, expect, it } from 'vitest'
import { shouldResetApproval } from '../src/repos/course.repo'

const planA = { slug: 'c', units: [{ slug: 'u1', lessons: [{ slug: 'bai-goc' }] }] }
const planB = { slug: 'c', units: [{ slug: 'u1', lessons: [{ slug: 'bai-moi' }] }] }

describe('khi nào con dấu duyệt phải bị gỡ', () => {
  it('đã duyệt + nội dung đổi → GỠ', () => {
    expect(shouldResetApproval({ status: 'APPROVED', plan: planA }, planB)).toBe(true)
  })

  it('đã phát hành + nội dung đổi → GỠ (phát hành còn nặng hơn duyệt)', () => {
    expect(shouldResetApproval({ status: 'PUBLISHED', plan: planA }, planB)).toBe(true)
  })

  it('đã duyệt nhưng nội dung Y HỆT → giữ, không phạt người bấm hai lần', () => {
    expect(shouldResetApproval({ status: 'APPROVED', plan: planA }, planA)).toBe(false)
  })

  it('chưa duyệt thì không có gì để gỡ', () => {
    expect(shouldResetApproval({ status: 'DRAFT', plan: planA }, planB)).toBe(false)
    expect(shouldResetApproval({ status: 'NEEDS_REVIEW', plan: planA }, planB)).toBe(false)
  })

  it('chưa từng có vỏ khoá nào ở slug đó → không phải chuyện gỡ', () => {
    expect(shouldResetApproval(null, planB)).toBe(false)
  })
})

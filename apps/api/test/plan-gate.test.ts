// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * CON DẤU DUYỆT CỦA CẤP DƯỚI khi cấp trên bị sinh lại.
 *
 * Kế hoạch ba cấp — khoá, chương, bài — và cấp dưới được soạn DỰA TRÊN cấp trên đã duyệt. Sinh lại
 * cấp trên thì chính nó về bản nháp, nhưng cấp dưới đứng nguyên "đã duyệt": duyệt cho một ngữ cảnh
 * không còn tồn tại. Nặng hơn nữa, con dấu của chương chính là CỔNG cho phép sinh kế hoạch bài, nên
 * bài mới tiếp tục ra đời từ một cánh cổng mở bằng thứ vừa bị thay.
 *
 * Đo được trên kho trước khi sửa: duyệt đủ ba cấp, sinh lại kế hoạch khoá — khoá về nháp, chương và
 * bài vẫn đã-duyệt, cổng vẫn mở.
 */

import { describe, expect, it } from 'vitest'
import { descendantsOf } from '../src/repos/plan-hierarchy.repo'

const tree = [
  { unit: 'u1', lessons: ['l1', 'l2'] },
  { unit: 'u2', lessons: ['l3'] },
]

describe('sinh lại cấp nào thì làm mất hiệu lực những đâu', () => {
  it('sinh lại KHOÁ → mọi chương và mọi bài', () => {
    expect(descendantsOf(tree, 'course', 'c')).toEqual([
      { level: 'unit', refSlug: 'u1' },
      { level: 'unit', refSlug: 'u2' },
      { level: 'lesson', refSlug: 'l1' },
      { level: 'lesson', refSlug: 'l2' },
      { level: 'lesson', refSlug: 'l3' },
    ])
  })

  it('sinh lại MỘT CHƯƠNG → chỉ bài của chính chương đó', () => {
    // Hạ luôn bài của chương khác là phạt oan việc người ta chưa hề đụng tới.
    expect(descendantsOf(tree, 'unit', 'u1')).toEqual([
      { level: 'lesson', refSlug: 'l1' },
      { level: 'lesson', refSlug: 'l2' },
    ])
  })

  it('sinh lại một BÀI → không cấp nào bên dưới', () => {
    expect(descendantsOf(tree, 'lesson', 'l1')).toEqual([])
  })

  it('chương không có trong vỏ khoá → không chạm gì, không đoán bừa', () => {
    expect(descendantsOf(tree, 'unit', 'khong-co')).toEqual([])
  })
})

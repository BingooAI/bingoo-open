// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * NHẬN MỘT ĐỀ XUẤT LÀM DÀY — phần thuần: rút tên kiến thức khỏi câu kết luận của thẻ.
 *
 * Nhỏ nhưng là chỗ duy nhất biết kiến thức mới TÊN GÌ, và tên đó thành định danh vĩnh viễn. Đọc
 * trượt thì hoặc chặn được (không có tên), hoặc tệ hơn: đúc ra một kiến thức mang tên rác, và định
 * danh thì không sửa lại được.
 */

import { describe, expect, it } from 'vitest'
import { extractTitle } from '../src/services/proposal-accept.service'

describe('rút tên kiến thức khỏi câu kết luận', () => {
  it('câu tiếng Anh chuẩn', () => {
    expect(extractTitle('The book teaches "Estimate quantities" — the framework does not list it.')).toBe(
      'Estimate quantities',
    )
  })

  it('nháy kiểu cong (thứ hay gặp khi câu đi qua nhiều lớp)', () => {
    expect(extractTitle('Sách dạy “Ước lượng số lượng” — khung hiện chưa có.')).toBe('Ước lượng số lượng')
  })

  it('không có nháy nào → KHÔNG đoán bừa', () => {
    // Đoán ở đây là đúc một kiến thức mang tên rác, và định danh thì không sửa lại được.
    expect(extractTitle('The book teaches something new')).toBeUndefined()
  })

  it('nháy rỗng cũng là không có tên', () => {
    expect(extractTitle('The book teaches "" — nothing here.')).toBeUndefined()
  })
})

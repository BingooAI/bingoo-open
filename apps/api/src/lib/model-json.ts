// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * BÓC JSON TỪ CÂU TRẢ LỜI CỦA MODEL — và hỏng thì NÓI RA.
 *
 * Bốn chỗ trong repo từng chép cùng một đoạn: tìm cặp ngoặc đầu tiên, `JSON.parse`, và cả hai nhánh
 * hỏng đều trả về `{}`. Nhìn thì vô hại. Hậu quả thì không:
 *
 *   • Kế hoạch bài — mọi trường rơi vào giá trị dự phòng của bộ làm sạch, rồi cái đó được LƯU thành
 *     bản nháp kèm đủ tên model, mã prompt, dấu vân prompt. Hồ sơ nói AI soạn ra nó. AI không hề.
 *   • Kế hoạch khoá/chương — như trên, một tầng cao hơn.
 *   • Vỏ khoá học từ sách — ra một khoá rỗng, đọc lên như "sách này chẳng có gì".
 *   • Bản nháp khung — ra "trích được 0 khái niệm", đọc lên như tài liệu không có nội dung.
 *
 * Trong cả bốn ca, người dùng nhận một kết quả tệ và không có đường nào biết rằng thật ra KHÔNG CÓ
 * câu trả lời nào cả. Họ đi sửa tài liệu, sửa prompt, tách bài — sửa những thứ không hỏng.
 *
 * Nên chỗ này ném. Đúng tiền lệ đã có sẵn cho ca bị cắt vì hết token: hỏng thì dừng và nói hỏng ở
 * đâu, chứ không bịa ra một kết quả rỗng rồi ký tên AI vào đó.
 */

/** Câu trả lời của model không dùng được. Tách riêng để chỗ gọi phân biệt được với lỗi khác. */
export class ModelReplyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelReplyError'
  }
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

/**
 * `what` đi vào thông báo lỗi để người đọc biết BƯỚC NÀO hỏng — "không sinh được kế hoạch bài" khác
 * hẳn "không đọc được sách", và một câu chung chung buộc người ta phải đi dò.
 */
export function parseModelJson(text: string, what: string): Record<string, unknown> {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) {
    throw new ModelReplyError(`${what}: câu trả lời của model không chứa JSON nào. Hãy chạy lại.`)
  }
  try {
    return asRecord(JSON.parse(m[0]))
  } catch (e) {
    const why = e instanceof Error ? e.message : 'JSON hỏng'
    throw new ModelReplyError(`${what}: câu trả lời của model không đọc được (${why}). Hãy chạy lại.`)
  }
}

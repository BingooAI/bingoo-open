// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * CẮT MỘT PDF THÀNH TỪNG PHẦN ĐỦ NHỎ ĐỂ ĐỌC ẢNH ĐƯỢC.
 *
 * Sách giáo khoa quét thành ảnh không có lớp chữ nào để đọc thẳng, nên nó buộc phải qua dịch vụ đọc
 * ảnh; và dịch vụ đó có trần dung lượng mà một cuốn sách thật vượt qua dễ dàng. Trước file này,
 * đường bóc sách hỏng với đúng loại tệp nó tồn tại để xử lý.
 *
 * CẮT chứ không NÉN: giữ nguyên trang gốc, chỉ chia thành nhiều tệp. Nén ảnh xuống cho vừa là làm
 * hỏng chính thứ sắp phải đọc — chữ trong sách quét vốn đã mờ.
 */

import { PDFDocument } from 'pdf-lib'

/**
 * Cắt theo BYTE, không theo số trang cố định.
 *
 * Sách quét có trang nặng nhẹ rất khác nhau — một trang ảnh màu nặng gấp mấy chục lần một trang
 * chữ. Chia đều theo số trang thì có phần vẫn quá cỡ còn phần khác gần rỗng, và phần quá cỡ lại
 * hỏng đúng như cũ.
 *
 * Cách làm: gom dần từng trang, dựng thử, thấy vượt ngưỡng thì chốt phần trước đó. Tốn công hơn
 * chia đều, nhưng đây là việc chạy một lần cho mỗi cuốn sách.
 */
export async function splitPdfBySize(
  bytes: Uint8Array,
  maxBytes: number,
): Promise<{ chunks: Uint8Array[]; pageCount: number }> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const pageCount = src.getPageCount()
  if (pageCount === 0) return { chunks: [], pageCount: 0 }

  const chunks: Uint8Array[] = []
  let start = 0

  while (start < pageCount) {
    let end = start
    let lastGood: Uint8Array | undefined

    // Nới dần tới khi vượt ngưỡng, rồi lùi lại một bước.
    while (end < pageCount) {
      const out = await PDFDocument.create()
      const copied = await out.copyPages(
        src,
        Array.from({ length: end - start + 1 }, (_, i) => start + i),
      )
      for (const p of copied) out.addPage(p)
      const built = await out.save()
      if (built.byteLength > maxBytes && lastGood !== undefined) break
      lastGood = built
      end += 1
      // Một trang đơn lẻ đã vượt ngưỡng thì không cắt nhỏ hơn được nữa — nhận nó và đi tiếp, vì
      // bỏ qua một trang là nói dối về cuốn sách. Dịch vụ đọc ảnh sẽ tự từ chối phần đó nếu quá cỡ.
      if (built.byteLength > maxBytes) break
    }

    if (lastGood === undefined) break // không dựng nổi gì — thoát, đừng lặp vô hạn
    chunks.push(lastGood)
    start = end
  }

  return { chunks, pageCount }
}

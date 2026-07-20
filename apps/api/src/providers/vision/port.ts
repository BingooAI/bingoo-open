/**
 * VisionPort — ảnh/trang PDF-đã-rasterize → văn bản (OCR + đọc bố cục). Cổng capability mới;
 * vendor chọn qua env VISION_PROVIDER (mặc định claude). Dùng cho nguồn biên soạn PDF/ảnh.
 */

export interface ExtractTextInput {
  /** Nguồn: URL http(s), data URI, hoặc base64 thô — ẢNH hoặc PDF (đọc thẳng, không cần rasterize). */
  readonly image: string
  /** MIME khi là base64 thô: image/png (mặc định) … hoặc application/pdf. */
  readonly mediaType?: string
  /** Chỉ dẫn trích xuất (mặc định: OCR trung thực, giữ thứ tự đọc). */
  readonly prompt?: string
}

export interface ExtractTextResult {
  readonly text: string
  readonly model: string
}

export interface VisionPort {
  extractText(input: ExtractTextInput): Promise<ExtractTextResult>
}

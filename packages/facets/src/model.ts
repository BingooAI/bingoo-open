/**
 * FACETS — thứ PHÂN BIỆT hai KC, đưa vào DỮ LIỆU thay vì chôn trong câu chữ.
 *
 * Bài học từ Cambridge vs MOET: cái thực sự phân biệt "count to 20" với "count to 100" là PHẠM VI,
 * mà nó nằm lẫn trong một câu tiếng Anh → mọi phép so sánh thành đoán. Đưa nó ra thành field thì
 * "có phải cùng một KC không" trở thành SO SÁNH CẤU TRÚC, không cần ngưỡng, không cần LLM.
 *
 * THIẾT KẾ ĐỂ SỐNG VỚI HÀNG NGHÌN MÔN/NGÀNH:
 *   • 6 TRỤC là CODE (cố định, nhỏ) — xương sống không đổi.
 *   • "Chất liệu" của từng môn là DỮ LIỆU (DomainProfile) — thêm môn = thêm 1 dòng, KHÔNG đụng code.
 *   • Chỉ 3 trục là enum đóng vì chúng THỰC SỰ độc lập môn (bloom/transfer/fluency).
 *     3 trục còn lại để MỞ vì từ vựng của chúng là vô hạn theo môn (channel/scope/representation).
 */

/** Trục 2 — mức nhận thức. Bloom: phổ quát mọi môn (nêu ≠ giải thích ≠ thiết kế). */
export const BLOOM = ['recall', 'understand', 'apply', 'analyse', 'evaluate', 'create'] as const;
export type Bloom = (typeof BLOOM)[number];

/** Trục 5 — khoảng cách chuyển giao. Engine đã có tín hiệu `transfer` (Dreyfus). */
export const TRANSFER = ['familiar', 'near', 'far'] as const;
export type Transfer = (typeof TRANSFER)[number];

/** Trục 6 — ngưỡng thuần thục. Engine đã có tín hiệu `fluency`. */
export const FLUENCY = ['emerging', 'accurate', 'fluent', 'automatic'] as const;
export type Fluency = (typeof FLUENCY)[number];

/**
 * 6 trục phân biệt. Trục MỞ (channel/scope/representation) dùng chuỗi/record tự do — từ vựng của
 * chúng tích luỹ theo DỮ LIỆU, không compile vào code.
 */
export interface Facets {
  /**
   * ⓪ ĐỐI TƯỢNG TRI THỨC — "về CÁI GÌ". Trục QUAN TRỌNG NHẤT cho định danh.
   *
   * Thêm sau khi chạy Cambridge thật: 6 trục kia chỉ mô tả "làm thế nào / tới đâu" (kênh, mức nhận
   * thức, phạm vi, biểu diễn) — nên "chẵn/lẻ" và "phép cộng" ra facets GIỐNG HỆT nhau và bị coi là
   * cùng một KC. Sai nặng. Phải có trục "về cái gì".
   *
   * Là THUẬT NGỮ NGẮN đã chuẩn hoá (addition · parity · counting · fraction), KHÔNG phải câu văn —
   * nên vẫn là so sánh CẤU TRÚC, không quay về so chuỗi. Biến thể từ vựng do `DomainProfile.aliases`
   * chuẩn hoá. Chính trục này làm cho "Add within 20" (Cambridge) và "Cộng trong phạm vi 20" (VN)
   * ra CÙNG một KC.
   */
  readonly object?: string;
  /** ① Kênh/cách thể hiện: read|write|listen|speak (ngôn ngữ), perceive|produce|notate (nhạc)… MỞ. */
  readonly channel?: string;
  /** ② Mức nhận thức — phổ quát. */
  readonly bloom?: Bloom;
  /**
   * ③ Ngưỡng phạm vi/độ phức tạp. Hình dạng khác nhau theo môn: {max:100} · {lexis:2000} ·
   * {tempoBpm:120} · {variables:3}. So sánh theo CẤU TRÚC (cùng khoá + cùng giá trị).
   */
  readonly scope?: Readonly<Record<string, string | number>>;
  /** ④ Biểu diễn: concrete|pictorial|abstract · staff|tab · equation|model… MỞ. */
  readonly representation?: string;
  /** ⑤ Khoảng cách chuyển giao — phổ quát. */
  readonly transfer?: Transfer;
  /** ⑥ Ngưỡng thuần thục — phổ quát. */
  readonly fluency?: Fluency;
}

export const FACET_AXES = [
  'object',
  'channel',
  'bloom',
  'scope',
  'representation',
  'transfer',
  'fluency',
] as const;
export type FacetAxis = (typeof FACET_AXES)[number];

/**
 * Hồ sơ một MÔN/NGÀNH — DỮ LIỆU, không phải code. Sửa trong admin, thêm môn không cần deploy.
 * `requiredAxes`: trục nào bắt buộc phải khai ở môn này (vd Toán bắt buộc `scope`; Ngôn ngữ bắt buộc
 * `channel`). Thiếu → invariant bắt lỗi, chứ không im lặng cho qua.
 * `aliases`: chuẩn hoá đồng nghĩa ("listening"→"listen") — cũng là dữ liệu.
 */
export interface DomainProfile {
  readonly domain: string;
  readonly requiredAxes: readonly FacetAxis[];
  /**
   * Trục ĐỊNH DANH — chỉ những trục này mới được dùng để kết luận "KHÁC KC".
   *
   * Vì sao phải tách: 7 trục KHÔNG ngang nhau về độ tin cậy.
   *   • `object`, `scope` — ỔN ĐỊNH: thuật ngữ chuẩn hoá + con số nằm ngay trong văn bản.
   *   • `channel`, `bloom`, `representation` — NHIỄU: là PHÁN ĐOÁN của LLM, hai lần trích cùng một
   *     kiến thức từ hai tài liệu ra hai giá trị khác nhau ("explain" vs "recognise").
   * Nếu coi tất cả ngang nhau thì lệch ở trục nhiễu bị kết luận là "khác KC" → không tái dùng nổi
   * KC nào (thực đo trên MOET: 9/10 ra OVERLAP vô dụng), và giết luôn suy luận SUBSET/SUPERSET.
   *
   * Lệch ở trục MÔ TẢ (ngoài identityAxes) KHÔNG kết luận gì — nó chuyển sang UNKNOWN để LLM/người
   * phân xử, vì có thể là khác biệt thật, mà cũng có thể chỉ là nhiễu trích xuất.
   * Mặc định khi hồ sơ môn không khai: ['object', 'scope'].
   */
  readonly identityAxes?: readonly FacetAxis[];
  /** axis → { biến thể: giá trị chuẩn }. */
  readonly aliases?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/**
 * NHÃN + "học sinh làm gì" SONG NGỮ cho từng primitiveKind (author-facing; VI là ngôn ngữ UI).
 *
 * Co-located CẠNH registry (nguồn sự thật primitive) để hết hardcode rải ở app:
 *   · QUIZ (auto-key core) → bảng `QUIZ_DISPLAY` NGAY ĐÂY.
 *   · KIT (manip:) → uỷ thác `kitDisplay()` của @bingoo.ai/manipulatives (cạnh answer/objectImage của kit).
 *   · BLOCK (block:) / loại chưa khai → titleize từ slug, và KIT_DOCS.en làm mô tả dự phòng cho kit.
 * App chỉ gọi `primitiveDisplay(kind)` — KHÔNG giữ map nhãn riêng nữa.
 */

import { KIT_DOCS, kitDisplay } from '@bingoo.ai/manipulatives'
import { BLOCK_PREFIX, MANIP_PREFIX } from './registry'

export interface PrimitiveLoc {
  readonly vi: string
  readonly en: string
}
export interface PrimitiveDisplay {
  readonly label: PrimitiveLoc
  readonly desc: PrimitiveLoc | null
}

/** Tên đọc được từ slug khi chưa có nhãn: "count-on" → "Count On". */
const titleize = (s: string): string => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// QUIZ (dạng câu hỏi auto-key của core). label = tên nút; desc = "học sinh làm gì". Loại trùng tên với
// kit (tenframe, numberline, clock, placevalue, pattern, partwhole, estimate) là bản QUIZ — bản KIT ở
// manip: đi qua kitDisplay(), không lẫn.
const QUIZ_DISPLAY: Record<string, PrimitiveDisplay> = {
  single: {
    label: { vi: 'Chọn một', en: 'Single choice' },
    desc: { vi: 'Chọn MỘT đáp án đúng.', en: 'Pick one correct option.' },
  },
  multiple: {
    label: { vi: 'Chọn nhiều', en: 'Multiple choice' },
    desc: { vi: 'Chọn NHIỀU đáp án đúng.', en: 'Pick all correct options.' },
  },
  boolean: {
    label: { vi: 'Đúng / Sai', en: 'True / false' },
    desc: { vi: 'Xét một mệnh đề đúng hay sai.', en: 'Judge one statement.' },
  },
  fill: {
    label: { vi: 'Điền chỗ trống', en: 'Fill blank' },
    desc: { vi: 'Gõ từ/số còn thiếu vào chỗ trống.', en: 'Type the missing word/number.' },
  },
  numeric: {
    label: { vi: 'Nhập số', en: 'Numeric' },
    desc: { vi: 'Nhập một số chính xác.', en: 'Enter an exact number.' },
  },
  order: {
    label: { vi: 'Sắp thứ tự', en: 'Ordering' },
    desc: { vi: 'Kéo các mục vào đúng trình tự.', en: 'Drag into sequence.' },
  },
  match: {
    label: { vi: 'Nối cặp', en: 'Matching' },
    desc: { vi: 'Ghép mục ở hai cột với nhau.', en: 'Pair two columns.' },
  },
  wordbank: {
    label: { vi: 'Kho từ', en: 'Word bank' },
    desc: { vi: 'Kéo từ vào chỗ trống để ghép câu.', en: 'Drag words into slots.' },
  },
  categorize: {
    label: { vi: 'Phân loại', en: 'Categorize' },
    desc: { vi: 'Bỏ các mục vào đúng nhóm.', en: 'Sort into buckets.' },
  },
  sort: {
    label: { vi: 'Sắp xếp', en: 'Sort' },
    desc: { vi: 'Sắp theo quy tắc (lớn/nhỏ, giá trị…).', en: 'Sort by a rule.' },
  },
  highlight: {
    label: { vi: 'Tô / chọn', en: 'Highlight' },
    desc: { vi: 'Tô/chọn đúng phần của đoạn chữ hoặc hình.', en: 'Highlight the correct part(s).' },
  },
  hotspot: {
    label: { vi: 'Bấm vùng đúng', en: 'Hotspot' },
    desc: { vi: 'Bấm đúng vùng trên một hình ảnh.', en: 'Click the correct region.' },
  },
  label: {
    label: { vi: 'Gắn nhãn', en: 'Labeling' },
    desc: { vi: 'Kéo nhãn vào đúng vị trí trên sơ đồ.', en: 'Drag labels onto a diagram.' },
  },
  tally: {
    label: { vi: 'Dấu gạch đếm', en: 'Tally' },
    desc: { vi: 'Ghi số lượng bằng nét gạch, bó 5.', en: 'Tally marks (groups of 5).' },
  },
  numberline: {
    label: { vi: 'Trục số', en: 'Number line' },
    desc: { vi: 'Đặt điểm hoặc nhảy tới một giá trị trên trục.', en: 'Place/jump to a value.' },
  },
  clock: {
    label: { vi: 'Đồng hồ', en: 'Clock' },
    desc: { vi: 'Chỉnh kim tới giờ cần.', en: 'Set the hands.' },
  },
  tenframe: {
    label: { vi: 'Khung mười ô', en: 'Ten-frame' },
    desc: { vi: 'Đặt số chấm để thể hiện số lượng (0–10).', en: 'Place counters (0–10).' },
  },
  partwhole: {
    label: { vi: 'Phần – tổng', en: 'Part–whole' },
    desc: { vi: 'Tách một tổng thành các phần.', en: 'Number bond.' },
  },
  placevalue: {
    label: { vi: 'Giá trị vị trí', en: 'Place value' },
    desc: { vi: 'Dựng số từ trăm/chục/đơn vị.', en: 'Build a number by place.' },
  },
  pattern: {
    label: { vi: 'Quy luật', en: 'Pattern' },
    desc: { vi: 'Tiếp tục/hoàn thành dãy lặp.', en: 'Continue a pattern.' },
  },
  venn: {
    label: { vi: 'Biểu đồ Venn', en: 'Venn' },
    desc: { vi: 'Đặt mục vào đúng vùng giao.', en: 'Venn diagram.' },
  },
  tablefill: {
    label: { vi: 'Điền bảng', en: 'Table fill' },
    desc: { vi: 'Hoàn thành các ô còn thiếu của bảng.', en: 'Complete a table.' },
  },
  drawing: {
    label: { vi: 'Vẽ / tô nét', en: 'Drawing' },
    desc: {
      vi: 'Vẽ/tô theo hình hoặc CHỮ mẫu (cần nét mẫu để tô theo).',
      en: 'Trace a shape/glyph guide.',
    },
  },
  writing: {
    label: { vi: 'Viết nét', en: 'Writing' },
    desc: { vi: 'Viết chữ/số/từ, chấm theo nét.', en: 'Write, stroke-checked.' },
  },
  estimate: {
    label: { vi: 'Ước lượng', en: 'Estimate' },
    desc: { vi: 'Đoán gần đúng rồi kiểm bằng đếm/đo.', en: 'Estimate then check.' },
  },
  speech: {
    label: { vi: 'Nói', en: 'Speech' },
    desc: { vi: 'Trả lời bằng lời (đáp án nói).', en: 'Spoken response.' },
  },
  crossword: {
    label: { vi: 'Ô chữ', en: 'Crossword' },
    desc: { vi: 'Điền theo gợi ý hàng ngang/dọc.', en: 'Crossword.' },
  },
  math: {
    label: { vi: 'Biểu thức toán', en: 'Math' },
    desc: { vi: 'Nhập phương trình/biểu thức thoả đề.', en: 'Math expression.' },
  },
  chart: {
    label: { vi: 'Đọc biểu đồ', en: 'Chart' },
    desc: { vi: 'Trả lời từ biểu đồ/đồ thị.', en: 'Read a chart.' },
  },
  pictogram: {
    label: { vi: 'Biểu đồ tranh', en: 'Pictogram' },
    desc: { vi: 'Đọc/hoàn thành biểu đồ tranh.', en: 'Pictogram.' },
  },
}

/**
 * Nhãn + mô tả song ngữ cho MỘT primitiveKind, dispatch theo namespace. Luôn trả label (titleize nếu
 * chưa khai) — không bao giờ null; desc null nếu không có mô tả.
 */
export function primitiveDisplay(kind: string): PrimitiveDisplay {
  if (kind.startsWith(MANIP_PREFIX)) {
    const b = kind.slice(MANIP_PREFIX.length)
    const kd = kitDisplay(b)
    if (kd) return { label: kd.label, desc: kd.desc }
    // Kit chưa khai nhãn → titleize + mô tả dự phòng từ KIT_DOCS.en (câu đầu).
    const en = KIT_DOCS[b]?.desc ? KIT_DOCS[b]!.desc.split('. ')[0]! + '.' : ''
    return { label: { vi: titleize(b), en: titleize(b) }, desc: en ? { vi: en, en } : null }
  }
  if (kind.startsWith(BLOCK_PREFIX)) {
    const b = kind.slice(BLOCK_PREFIX.length)
    return { label: { vi: titleize(b), en: titleize(b) }, desc: null }
  }
  return QUIZ_DISPLAY[kind] ?? { label: { vi: titleize(kind), en: titleize(kind) }, desc: null }
}

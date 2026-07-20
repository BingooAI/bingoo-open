/**
 * SINH TỪNG ITEM MỘT (per-item, KHÔNG batch) — trụ cột của luồng soạn nội dung mới: người soạn bấm →
 * sinh 1 item → xem → DUYỆT hoặc SINH LẠI. Không sinh cả lô (để giữ chất lượng, soát từng cái).
 *
 * Đa ngôn ngữ: `languages` → sinh text cho mọi locale (en là GỐC). Kit (manip) sinh đa-locale đầy đủ;
 * quiz hiện sinh theo ngôn ngữ chính (schema QuizQuestion đa-locale sẽ nâng cấp sau — [[TODO]]).
 *
 * Media (ảnh/âm thanh) KHÔNG sinh ở đây: ảnh chọn thư viện / sinh mới sau khi ưng text; âm thanh bấm
 * sinh khi text đã duyệt (xem media resolver + luồng per-item ở admin).
 */

import type { AuthoredItem } from '@bingoo/authored-item';
import { MANIP_PREFIX } from '@bingoo/authored-item';
import type { DifficultyBand, GenerationSpec } from '@bingoo/personalization';
import type { Misconception } from '@bingoo/plans';
import { buildGeneratorPort, buildKitGeneratorPort } from './content-adapters';
import { renderMisconceptions } from './item-brief';
import { saveItems } from '../repos/content-item.repo';

type RepStage = 'concrete' | 'pictorial' | 'abstract';

/** Spec TỐI THIỂU để sinh 1 item (không cần cả contentPlan của học viên). */
function specForItem(
  kc: string,
  band: DifficultyBand,
  language: string,
  rep: RepStage,
): GenerationSpec {
  return {
    targetKcs: [kc],
    variant: 'single',
    difficultyBand: band,
    bandRange: [band],
    scaffolding: { hintOpenLevel: 1, representationStage: rep },
    reviewInserts: [],
    language,
    pace: 'standard',
  };
}

export interface GenerateItemInput {
  kc: string;
  /** Quiz kind (vd 'single', 'numberline') HOẶC kit 'manip:tenframe'. */
  primitiveKind: string;
  /** Gắn item vào bài (để soát/list theo bài). */
  lessonSlug?: string;
  /**
   * Gắn item vào ĐÚNG BƯỚC (content step) đã sinh — VÀO itemKey (`kc::stepSlug::kind::seq`). BẮT BUỘC để
   * tách item giữa các bước CÙNG KC: không có nó, một item của KC khớp MỌI bước cùng KC/loại → "duyệt 1
   * cái mà nhiều bước cùng hiện đã duyệt" (bug trùng). Bỏ trống = item chung KC (tương thích cũ).
   */
  stepSlug?: string;
  /** Brief step (grounding) — item bám đúng ý đồ step, không sinh chung chung theo KC. */
  brief?: string;
  band?: DifficultyBand;
  /** Đa ngôn ngữ — en luôn được thêm làm gốc. Mặc định [vi]. */
  languages?: readonly string[];
  representation?: RepStage;
  /** Điểm sai thường gặp của KC (từ plan bài) — seed distractor NHẮM đúng + item chẩn đoán. Xem [[item-brief]]. */
  misconceptions?: readonly Misconception[];
  aiKey?: string;
  /** Lưu DRAFT để soát/duyệt sau (mặc định true). false = chỉ trả về, không lưu. */
  persist?: boolean;
  /**
   * Số thứ tự item trong (KC, primitiveKind) → nằm trong itemKey. "Sinh lại" dùng LẠI seq cũ (đè bản
   * nháp); "Sinh mới" dùng seq mới (giữ bản cũ). Mặc định 0.
   */
  seq?: number;
}

/**
 * ĐỊNH DẠNG itemKey — NGUỒN DUY NHẤT: `kc::[stepSlug::]kind::seq`. stepSlug (bước sở hữu) nằm GIỮA để
 * item thuộc ĐÚNG một bước; panel soát lọc theo prefix `kc::stepSlug::`. Bỏ stepSlug = key cũ 3 phần.
 */
export function contentItemKey(kc: string, kind: string, seq: number, stepSlug?: string): string {
  return [kc, ...(stepSlug ? [stepSlug] : []), kind, String(seq)].join('::');
}

/**
 * Dựng lại itemKey (và payload.id) theo `contentItemKey`. Port trả `kc::kind::index`; ta rút kc+kind rồi
 * thay index bằng seq ("sinh mới" vs "sinh lại") và CHÈN stepSlug (nếu có).
 */
function reKey(item: AuthoredItem, seq: number, stepSlug?: string): AuthoredItem {
  const parts = item.itemKey.split('::');
  const kc = parts[0]!;
  const kind = parts.slice(1, -1).join('::'); // phần loại (không chứa `::` trên thực tế)
  const itemKey = contentItemKey(kc, kind, seq, stepSlug);
  const payload =
    item.payload && typeof item.payload === 'object'
      ? { ...(item.payload as Record<string, unknown>), id: itemKey }
      : item.payload;
  return { ...item, itemKey, payload };
}

/**
 * Sinh ĐÚNG MỘT item cho (KC, primitiveKind). Chọn port theo namespace: `manip:` → kit generator
 * (chấm bằng checkAnswer), còn lại → quiz generator (auto-key). Trả item (đã lưu DRAFT) hoặc null nếu
 * LLM không ra item hợp lệ (vd sai hợp đồng đáp án kit → bị loại).
 */
export async function generateOneItem(input: GenerateItemInput): Promise<AuthoredItem | null> {
  const band = input.band ?? 'core';
  const languages = input.languages && input.languages.length ? input.languages : ['vi'];
  const primary = languages[0] ?? 'vi';
  const spec = specForItem(input.kc, band, primary, input.representation ?? 'pictorial');
  const aiOpt = input.aiKey ? { aiKey: input.aiKey } : {};

  const isKit = input.primitiveKind.startsWith(MANIP_PREFIX);
  const briefOpt = input.brief ? { brief: input.brief } : {};
  // Misconceptions của KC → khối text seed distractor/chẩn đoán (đúng locale chính). Rỗng → bỏ qua.
  const mcText = renderMisconceptions(input.misconceptions, primary);
  const mcOpt = mcText ? { misconceptions: mcText } : {};
  const port = isKit
    ? buildKitGeneratorPort({
        kinds: [input.primitiveKind.slice(MANIP_PREFIX.length)],
        count: 1,
        languages,
        ...briefOpt,
        ...mcOpt,
        ...aiOpt,
      })
    : buildGeneratorPort({
        kinds: [input.primitiveKind],
        count: 1,
        languages,
        ...briefOpt,
        ...mcOpt,
        ...aiOpt,
      });

  // LLM đôi khi ra JSON hỏng / target sai hợp đồng (bị loại) → port rỗng. Per-item nên THỬ LẠI 1 lần
  // trước khi báo lỗi cho người soạn (giảm hẳn "thử lại thủ công"). Vẫn rỗng → trả null (route báo lỗi).
  let raw = (await port.generate(spec, input.kc))[0] ?? null;
  if (!raw) raw = (await port.generate(spec, input.kc))[0] ?? null;
  if (!raw) return null;
  const rekeyed = reKey(raw, input.seq ?? 0, input.stepSlug);
  // Đóng dấu FACETS (biểu diễn + độ khó) vào payload → coverage rich-bank phân loại được item vào đúng ô
  // (rep×band). Đây là metadata soạn, hộp đen với engine chấm. Xem [[bank-policy]].
  const facets = { representation: input.representation ?? 'pictorial', band };
  const payload =
    rekeyed.payload && typeof rekeyed.payload === 'object'
      ? { ...(rekeyed.payload as Record<string, unknown>), facets }
      : rekeyed.payload;
  const stamped: AuthoredItem = { ...rekeyed, payload };
  const item: AuthoredItem = input.lessonSlug
    ? { ...stamped, lessonSlug: input.lessonSlug }
    : stamped;
  if (input.persist !== false) await saveItems([item], 'DRAFT');
  return item;
}

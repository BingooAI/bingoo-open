/**
 * Text ĐA NGÔN NGỮ cho nội dung học (đề bài, nhãn đáp án, giải thích…). Một field có thể là:
 *   · CHUỖI thường (một ngôn ngữ) — tương thích NGƯỢC: mọi content cũ vẫn hợp lệ, không migration;
 *   · BẢN ĐỒ locale → text `{ en, vi, … }` — nội dung đa ngôn ngữ mới.
 *
 * Vì sao union (không bắt buộc map): schema core (`quiz.ts`, `content.ts`) đang lưu string; ép map ngay
 * sẽ vô hiệu toàn bộ item đã có. Union cho phép chuyển DẦN từng field + từng loại, an toàn.
 *
 * Render/chấm KHÔNG đọc trực tiếp field text nữa — luôn qua `pickText(value, locale)` để lấy đúng chuỗi.
 */
import { z } from 'zod';

/** Chuỗi một-ngôn-ngữ HOẶC bản đồ locale→text. `en` luôn là gốc. */
export const LocalizedString = z.union([z.string(), z.record(z.string().min(1), z.string())]);
export type LocalizedString = z.infer<typeof LocalizedString>;

/**
 * Rút chuỗi hiển thị cho MỘT locale từ một `LocalizedString`:
 *   · chuỗi thường → chính nó (bất kể locale);
 *   · map → `[locale]`, thiếu thì `en`, thiếu nữa thì giá trị đầu tiên;
 *   · rỗng/null → ''.
 * Thuần, không I/O — dùng được cả ở core (grade), web/native (render), server.
 */
export function pickText(value: LocalizedString | undefined | null, locale = 'en'): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[locale] ?? value.en ?? Object.values(value)[0] ?? '';
}

/** true nếu value là bản đồ locale (đa ngôn ngữ) chứ không phải chuỗi thường. */
export function isLocalizedMap(
  value: LocalizedString | undefined | null,
): value is Record<string, string> {
  return value != null && typeof value === 'object';
}

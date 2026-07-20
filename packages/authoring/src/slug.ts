// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Sinh slug ổn định từ tiêu đề. Slug là khoá tham chiếu bền (B5) — TIẾNG ANH LÀ GỐC. */

import type { LocalizedText } from './model'

/**
 * TIẾNG ANH LÀ GỐC — mọi slug (KC, skill, objective…) mint từ tiêu đề tiếng Anh, bất kể nguồn tiếng gì.
 * Vì sao BẮT BUỘC: cùng "phép cộng trong phạm vi 20" (SGK Việt) và "Add within 20" (Cambridge) phải ra
 * CÙNG MỘT slug `add-within-20` — nếu slug theo ngôn ngữ nguồn thì sẽ đẻ 2 KC cho một kiến thức,
 * và bằng chứng học tập bị tách đôi. Hiển thị thì dịch từ `title` (đa ngữ), KHÔNG dùng slug để hiện.
 * Hệ quả tốt: dedup so tiêu đề tiếng Anh nên khớp được xuyên ngôn ngữ mà chưa cần embedding.
 */
export function canonicalTitle(t: LocalizedText): string {
  return t['en'] ?? t['en-US'] ?? Object.values(t)[0] ?? ''
}

/**
 * Trần độ dài slug. Slug là KHOÁ BỀN (Observation/SkillState/ContentItem/plans đều trỏ vào nó),
 * nên phải NGẮN và ổn định. Nguồn thật hay cho cả câu dài ("Count objects from 0 to 20, recognising
 * conservation of number and one-to-one correspondence") → slug 80+ ký tự, xấu và dễ vỡ khi biên tập lại.
 * Cắt ở ranh giới từ; chống trùng đã có mintSlug lo.
 */
const MAX_SLUG = 56

/** "Phép cộng có nhớ" → "phep-cong-co-nho". Bỏ dấu, đ→d, kebab-case, cắt trần theo từ. */
export function slugify(s: string): string {
  const out = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu tổ hợp
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (out.length === 0) return 'concept'
  if (out.length <= MAX_SLUG) return out
  const cut = out.slice(0, MAX_SLUG)
  const lastDash = cut.lastIndexOf('-')
  const trimmed = lastDash > MAX_SLUG / 2 ? cut.slice(0, lastDash) : cut
  return trimmed.replace(/-+$/g, '') || 'concept'
}

/** Mint slug không trùng: base, base-2, base-3… `taken` được cập nhật. */
export function mintSlug(base: string, taken: Set<string>): string {
  const b = slugify(base)
  if (!taken.has(b)) {
    taken.add(b)
    return b
  }
  let i = 2
  while (taken.has(`${b}-${i}`)) i++
  const slug = `${b}-${i}`
  taken.add(slug)
  return slug
}

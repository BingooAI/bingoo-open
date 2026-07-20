/** Độ tương tự trigram (Dice) để chống trùng node rẻ trước khi gọi embedding (SPEC D.4). */

import { slugify } from './slug'

/** Tập trigram của chuỗi đã chuẩn hoá (slug) — có đệm biên. */
export function trigrams(s: string): Set<string> {
  const t = `  ${slugify(s).replace(/-/g, ' ')} `
  const set = new Set<string>()
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3))
  return set
}

/** Hệ số Dice ∈ [0,1]: 2·|A∩B| / (|A|+|B|). 1 = trùng khít, 0 = rời hẳn. */
export function diceSimilarity(a: string, b: string): number {
  const ta = trigrams(a)
  const tb = trigrams(b)
  if (ta.size === 0 && tb.size === 0) return 1
  let inter = 0
  for (const g of ta) if (tb.has(g)) inter++
  return (2 * inter) / (ta.size + tb.size)
}

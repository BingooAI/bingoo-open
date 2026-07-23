// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Luật ĐỊNH DANH — phổ quát, không cần biết môn gì.
 *
 * Thay "đo độ giống" (số mờ, luôn sai) bằng một VỊ TỪ dứt khoát trên dữ liệu có cấu trúc:
 *   • khác nhau ở BẤT KỲ facet nào đã khai  → KHÁC KC (chắc chắn, không cần LLM, không cần ngưỡng)
 *   • trùng khít mọi facet đã khai + cả hai khai đủ → CÙNG KC (ứng viên gộp)
 *   • một bên khai, bên kia không → KHÔNG BIẾT → đẩy người duyệt (KHÔNG BAO GIỜ tự gộp)
 *
 * Gộp sai làm hỏng vĩnh viễn xương sống bằng chứng mà không phát tín hiệu lỗi nào — nên mặc định
 * của hệ thống phải là "không gộp", chỉ gộp khi có bằng chứng cấu trúc.
 */

import { FACET_AXES, type DomainProfile, type FacetAxis, type Facets } from './model'

export type IdentityVerdict = 'SAME' | 'DIFFERENT' | 'UNKNOWN'

export interface IdentityResult {
  readonly verdict: IdentityVerdict
  /** Trục làm nên khác biệt (verdict=DIFFERENT) hoặc trục thiếu khai (verdict=UNKNOWN). */
  readonly axes: readonly FacetAxis[]
  readonly reason: string
}

const norm = (v: string): string => v.trim().toLowerCase()

/**
 * A facet axis value is usable only if it is a non-blank STRING. Facets arrive LOOSELY — from LLM
 * extraction, hand editing, and external CASE packages — so a value may be `null`, a number, an
 * object, or `""`. Such a value is treated as ABSENT rather than normalised, so an invariant that
 * REQUIRES the axis reports it missing (a proper validation error) instead of throwing on `.trim()`
 * — which would turn a malformed facet into a 500 at the `/apply` gate.
 */
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined)

/** `scope` is usable only if it is a plain object; `null`/array/scalar is treated as absent. */
const isScope = (v: unknown): v is Readonly<Record<string, string | number>> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Chuẩn hoá theo alias của môn (dữ liệu): "listening" → "listen". Bền với facets sai kiểu. */
export function normalizeFacets(f: Facets, profile?: DomainProfile): Facets {
  const alias = (axis: string, v: string): string => {
    const map = profile?.aliases?.[axis]
    const n = norm(v)
    return map?.[n] ?? n
  }
  const object = str(f.object)
  const channel = str(f.channel)
  const representation = str(f.representation)
  return {
    ...(object !== undefined ? { object: alias('object', object) } : {}),
    ...(channel !== undefined ? { channel: alias('channel', channel) } : {}),
    ...(f.bloom !== undefined ? { bloom: f.bloom } : {}),
    ...(isScope(f.scope) ? { scope: normScope(f.scope) } : {}),
    ...(representation !== undefined ? { representation: alias('representation', representation) } : {}),
    ...(f.transfer !== undefined ? { transfer: f.transfer } : {}),
    ...(f.fluency !== undefined ? { fluency: f.fluency } : {}),
  }
}

function normScope(s: Readonly<Record<string, string | number>>): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const k of Object.keys(s).sort()) {
    const v = s[k]
    if (v === undefined) continue
    out[norm(k)] = typeof v === 'string' ? norm(v) : v
  }
  return out
}

/** Khoá định danh tất định — hai KC cùng khoá thì cùng danh tính. Dùng để phát hiện trùng O(n). */
export function facetKey(f: Facets): string {
  const n = normalizeFacets(f)
  return FACET_AXES.map((a) => {
    const v = n[a]
    if (v === undefined) return `${a}:∅`
    return `${a}:${a === 'scope' ? JSON.stringify(v) : String(v)}`
  }).join('|')
}

const declared = (f: Facets): FacetAxis[] => FACET_AXES.filter((a) => f[a] !== undefined)

const eq = (a: unknown, b: unknown): boolean =>
  typeof a === 'object' || typeof b === 'object' ? JSON.stringify(a) === JSON.stringify(b) : a === b

/**
 * So định danh hai KC. KHÔNG trả về điểm số — trả về phán quyết + lý do kiểm chứng được.
 * `profile.requiredAxes` là thứ quyết định "khai đủ chưa": thiếu trục bắt buộc → UNKNOWN, không SAME.
 */
/** Trục định danh mặc định: chỉ những trục ỔN ĐỊNH. Trục nhiễu (do LLM phán) KHÔNG được kết luận. */
export const DEFAULT_IDENTITY_AXES: readonly FacetAxis[] = ['object', 'scope']

export function compareIdentity(a: Facets, b: Facets, profile?: DomainProfile): IdentityResult {
  const x = normalizeFacets(a, profile)
  const y = normalizeFacets(b, profile)
  const identityAxes = profile?.identityAxes ?? DEFAULT_IDENTITY_AXES

  // (1) Lệch ở trục ĐỊNH DANH (ổn định) → KHÁC KC. Dứt khoát.
  const conflicting = identityAxes.filter(
    (ax) => x[ax] !== undefined && y[ax] !== undefined && !eq(x[ax], y[ax]),
  )
  if (conflicting.length > 0) {
    return {
      verdict: 'DIFFERENT',
      axes: conflicting,
      reason: `Khác ở trục ĐỊNH DANH: ${conflicting.join(', ')} → không thể là cùng một KC.`,
    }
  }

  // (1b) Lệch ở trục MÔ TẢ → KHÔNG kết luận. Có thể là khác biệt thật (đọc ≠ viết), cũng có thể chỉ
  // là nhiễu trích xuất ("explain" vs "recognise" cho cùng một kiến thức). Đẩy sang LLM/người.
  const softConflicts = FACET_AXES.filter(
    (ax) => !identityAxes.includes(ax) && x[ax] !== undefined && y[ax] !== undefined && !eq(x[ax], y[ax]),
  )
  if (softConflicts.length > 0) {
    return {
      verdict: 'UNKNOWN',
      axes: softConflicts,
      reason:
        `Trục định danh trùng khít, nhưng lệch ở trục MÔ TẢ: ${softConflicts.join(', ')}. ` +
        'Có thể là khác biệt thật, cũng có thể chỉ là nhiễu trích xuất → cần phân xử.',
    }
  }

  // (2) Trục BẮT BUỘC của môn mà một bên chưa khai → không đủ căn cứ để gộp.
  const required = profile?.requiredAxes ?? []
  const missing = required.filter((ax) => x[ax] === undefined || y[ax] === undefined)
  if (missing.length > 0) {
    return {
      verdict: 'UNKNOWN',
      axes: missing,
      reason: `Thiếu trục bắt buộc: ${missing.join(', ')} → người duyệt quyết, KHÔNG tự gộp.`,
    }
  }

  // (3) Trục một bên khai, bên kia bỏ trống → cũng chưa đủ căn cứ.
  const asym = FACET_AXES.filter((ax) => (x[ax] === undefined) !== (y[ax] === undefined))
  if (asym.length > 0) {
    return {
      verdict: 'UNKNOWN',
      axes: asym,
      reason: `Một bên khai, bên kia không: ${asym.join(', ')} → người duyệt quyết.`,
    }
  }

  // (4) Cả hai khai đủ và trùng khít.
  const shared = declared(x)
  if (shared.length === 0) {
    return {
      verdict: 'UNKNOWN',
      axes: [],
      reason: 'Chưa khai facet nào → không có căn cứ cấu trúc.',
    }
  }
  return {
    verdict: 'SAME',
    axes: shared,
    reason: `Trùng khít mọi trục đã khai (${shared.join(', ')}).`,
  }
}

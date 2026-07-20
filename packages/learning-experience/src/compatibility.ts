/**
 * Luật TƯƠNG THÍCH — không phải tổ hợp 5 trục nào cũng có nghĩa. Thay "cảm giác kỳ kỳ" bằng một
 * VỊ TỪ dứt khoát trên dữ liệu có cấu trúc (giống `@bingoo/facets.compareIdentity`):
 *
 *   • INVALID     — MÂU THUẪN cấu trúc, không thể tồn tại (vd: học trực tiếp mà lại tự học async).
 *   • DISCOURAGED — chạy được nhưng LỆCH KHUÔN, gần như luôn là nhầm (vd: "feed" mà theo lớp).
 *   • VALID       — không vi phạm luật nào.
 *
 * Luật là dữ liệu-hoá thành hàm nhỏ, mỗi hàm canh MỘT lớp mâu thuẫn + trả LÝ DO kiểm chứng được
 * (dev-facing, không phải text người dùng). Không LLM, không ngưỡng mờ.
 */

import type { Axis } from './axes'
import type { ExperienceDescriptor } from './descriptor'

export type CompatibilitySeverity = 'INVALID' | 'DISCOURAGED'
export type CompatibilityVerdict = 'VALID' | 'DISCOURAGED' | 'INVALID'

export interface CompatibilityViolation {
  /** Mã luật ổn định — host có thể map sang thông điệp i18n riêng nếu muốn. */
  readonly rule: string
  readonly severity: CompatibilitySeverity
  /** Các trục làm nên mâu thuẫn. */
  readonly axes: readonly Axis[]
  /** Giải thích kiểm chứng được (tiếng Việt, dev-facing). */
  readonly reason: string
}

export interface CompatibilityResult {
  readonly verdict: CompatibilityVerdict
  readonly violations: readonly CompatibilityViolation[]
}

type Rule = (d: ExperienceDescriptor) => CompatibilityViolation | null

const RULES: readonly Rule[] = [
  // ── Mâu thuẫn cứng (INVALID) ────────────────────────────────────────────────
  (d) =>
    d.time === 'live' && d.delivery === 'async'
      ? {
          rule: 'live-time-needs-sync-delivery',
          severity: 'INVALID',
          axes: ['time', 'delivery'],
          reason: 'Thời gian "trực tiếp" không thể chạy trong định dạng tự học không đồng bộ (async).',
        }
      : null,

  (d) =>
    d.scale === 'solo' && d.companion !== 'ai' && d.companion !== 'self'
      ? {
          rule: 'solo-needs-self-or-ai',
          severity: 'INVALID',
          axes: ['scale', 'companion'],
          reason:
            'Quy mô "một mình" chỉ đi cùng đồng hành máy (AI) hoặc tự học — có người dạy/mentor/bạn tức là đã ≥2 người (pair/group).',
        }
      : null,

  (d) =>
    d.scale === 'pair' && (d.companion === 'ai' || d.companion === 'self')
      ? {
          rule: 'pair-needs-human',
          severity: 'INVALID',
          axes: ['scale', 'companion'],
          reason: 'Quy mô "1 kèm 1" cần một người thật đồng hành, không phải AI hay tự học.',
        }
      : null,

  (d) =>
    d.delivery === 'classroom' && (d.scale === 'solo' || d.scale === 'pair')
      ? {
          rule: 'classroom-needs-cohort',
          severity: 'INVALID',
          axes: ['delivery', 'scale'],
          reason: 'Định dạng "lớp học" hàm ý một tập thể (group/class), không thể solo/1-kèm-1.',
        }
      : null,

  // ── Lệch khuôn (DISCOURAGED) ────────────────────────────────────────────────
  (d) =>
    d.experience === 'arena' && d.scale === 'solo'
      ? {
          rule: 'arena-wants-competition',
          severity: 'DISCOURAGED',
          axes: ['experience', 'scale'],
          reason: 'Arena mang tính thi đấu — solo mất đối thủ; thường đi cùng group/class.',
        }
      : null,

  (d) =>
    d.experience === 'feed' && (d.delivery !== 'async' || d.scale !== 'solo')
      ? {
          rule: 'feed-is-solo-async',
          severity: 'DISCOURAGED',
          axes: ['experience', 'delivery', 'scale'],
          reason: 'Feed là dòng khám phá ngắn, cá nhân — hợp nhất với async + solo.',
        }
      : null,

  (d) =>
    d.delivery === 'classroom' &&
    d.companion !== 'teacher' &&
    d.companion !== 'ta' &&
    d.companion !== 'mentor'
      ? {
          rule: 'classroom-wants-instructor',
          severity: 'DISCOURAGED',
          axes: ['delivery', 'companion'],
          reason: 'Lớp học thường có người dẫn (teacher/TA/mentor); thiếu thì chỉ còn là nhóm tự học.',
        }
      : null,
]

/** Chấm một descriptor: gom mọi vi phạm rồi rút gọn thành verdict tổng. */
export function checkCompatibility(d: ExperienceDescriptor): CompatibilityResult {
  const violations = RULES.map((r) => r(d)).filter((v): v is CompatibilityViolation => v !== null)
  const verdict: CompatibilityVerdict = violations.some((v) => v.severity === 'INVALID')
    ? 'INVALID'
    : violations.length > 0
      ? 'DISCOURAGED'
      : 'VALID'
  return { verdict, violations }
}

/** Có tồn tại được không (không có mâu thuẫn cứng). DISCOURAGED vẫn tính là hợp lệ. */
export function isValid(d: ExperienceDescriptor): boolean {
  return checkCompatibility(d).verdict !== 'INVALID'
}

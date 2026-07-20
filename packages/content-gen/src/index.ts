/**
 * @bingoo/content-gen — S4b: GenerationSpec → (GeneratorPort) → AuthoredItem[] → ráp & kiểm ContentBundle.
 * Phần THUẦN: hợp đồng cổng + ráp/kiểm; adapter LLM thật ở apps/api.
 * Bất biến: engine chỉ nhận Observation; content là hộp đen (CONTENT-ARCHITECTURE §4).
 */

import type { AuthoredItem } from '@bingoo/authored-item'
import { isKnownPrimitive } from '@bingoo/authored-item'
import type { Elo, Slug } from '@bingoo/knowledge-engine'
import type { DifficultyBand, GenerationSpec } from '@bingoo/personalization'

/**
 * Cổng sinh CONTENT ĐÁNH GIÁ (đo) — quiz item measurable → Candidate → evidence.
 * Host cấp (adapter Claude ở apps/api). content-gen KHÔNG biết vendor.
 */
export interface GeneratorPort {
  generate(spec: GenerationSpec, kc: Slug): Promise<readonly AuthoredItem[]>
}

/**
 * Cổng sinh CONTENT HỌC (phơi bày) — content block để đọc/xem, KHÔNG đo (measurable=false).
 * Cùng chữ ký nhưng KHÁC bản chất: không sinh Observation, không vào bank chọn.
 */
export interface ExpositionPort {
  generate(spec: GenerationSpec, kc: Slug): Promise<readonly AuthoredItem[]>
}

/**
 * Cổng sinh CONTENT ÔN TẬP — flashcard (measurable=false), lịch ôn theo SRS (SM-2) per-learner.
 * KHÔNG đo/không sinh evidence; là tự-ôn (giống telemetry: ngoài xương sống bằng chứng).
 */
export interface FlashcardPort {
  generate(spec: GenerationSpec, kc: Slug): Promise<readonly AuthoredItem[]>
}

// Ngưỡng Elo → band (baseline 1500). Hiệu chuẩn sau theo cộng đồng; đổi ở đây một chỗ.
const EASY_MAX = 1400
const STRETCH_MIN = 1600

export function bandOf(elo: Elo): DifficultyBand {
  if (elo < EASY_MAX) return 'easy'
  if (elo > STRETCH_MIN) return 'stretch'
  return 'core'
}

export type BundleIssueCode = 'EMPTY' | 'MISSING_KC' | 'OFF_BAND' | 'UNKNOWN_PRIMITIVE'

export interface BundleIssue {
  readonly code: BundleIssueCode
  readonly severity: 'error' | 'warn'
  readonly message: string
  readonly kc?: Slug
  readonly itemKey?: string
}

export interface ContentBundle {
  readonly spec: GenerationSpec
  readonly items: readonly AuthoredItem[]
  readonly issues: readonly BundleIssue[]
  readonly approvable: boolean // không còn issue severity 'error'
}

/** Ráp danh sách item đã sinh thành bundle + kiểm khớp spec (phủ KC, đúng band, primitive hợp lệ). */
export function assembleBundle(spec: GenerationSpec, items: readonly AuthoredItem[]): ContentBundle {
  const issues: BundleIssue[] = []

  if (items.length === 0) {
    issues.push({ code: 'EMPTY', severity: 'error', message: 'Chưa sinh được item nào.' })
  }

  const covered = new Set<Slug>(items.flatMap((i) => [...i.skills]))
  for (const kc of spec.targetKcs) {
    if (!covered.has(kc)) {
      issues.push({
        code: 'MISSING_KC',
        severity: 'error',
        message: `Thiếu item cho KC ${kc}.`,
        kc,
      })
    }
  }

  for (const it of items) {
    if (!isKnownPrimitive(it.primitiveKind)) {
      issues.push({
        code: 'UNKNOWN_PRIMITIVE',
        severity: 'error',
        message: `Primitive lạ: ${it.primitiveKind}.`,
        itemKey: it.itemKey,
      })
    }
    if (!spec.bandRange.includes(bandOf(it.difficulty))) {
      issues.push({
        code: 'OFF_BAND',
        severity: 'warn',
        message: `Độ khó ${it.difficulty} (${bandOf(it.difficulty)}) ngoài dải ${spec.bandRange.join('/')}.`,
        itemKey: it.itemKey,
      })
    }
  }

  return {
    spec,
    items,
    issues,
    approvable: issues.every((i) => i.severity !== 'error'),
  }
}

/** Trọn nội dung 1 bài: TÁCH 3 loại — học (phơi bày) · đánh giá (đo) · ôn tập (SRS). */
export interface LessonContentBundle {
  readonly spec: GenerationSpec
  /** Content HỌC — block phơi bày (measurable=false), để đọc/xem, không đo. */
  readonly teaching: readonly AuthoredItem[]
  /** Content ĐÁNH GIÁ — quiz đã ráp/kiểm (measurable=true), sinh Candidate/evidence. */
  readonly assessment: ContentBundle
  /** Content ÔN TẬP — flashcard (measurable=false), lịch ôn SRS per-learner. */
  readonly review: readonly AuthoredItem[]
}

/** Ráp trọn bài từ 3 luồng sinh: học + đánh giá + ôn tập. */
export function assembleLessonContent(
  spec: GenerationSpec,
  teaching: readonly AuthoredItem[],
  assessmentItems: readonly AuthoredItem[],
  review: readonly AuthoredItem[] = [],
): LessonContentBundle {
  return { spec, teaching, assessment: assembleBundle(spec, assessmentItems), review }
}

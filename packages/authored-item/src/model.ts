/**
 * Lớp NEO — nối primitive nội dung (@bingoo.ai/core) vào knowledge-engine.
 *
 * Envelope mỏng bọc quanh payload primitive, mang metadata engine cần (skills, difficulty,
 * mode, itemKey). KHÔNG sửa primitive — payload là hộp đen với engine.
 * `Grade` tái dùng của @bingoo.ai/core (không định nghĩa lại).
 */

import type { AssessmentMode, Elo, Slug } from '@bingoo.ai/knowledge-engine'
import type { Grade } from '@bingoo.ai/core'

export type { Grade } from '@bingoo.ai/core'

/** Cách chấm — ngầm theo primitiveKind (§5 engine). */
export type GraderKind =
  'auto-key' | 'rubric' | 'code' | 'llm' | 'peer' | 'observation' | 'coverage' | 'manip'

export interface AuthoredItem {
  /** Định danh ổn định — Observation.itemKey + khoá hiệu chuẩn độ khó. */
  readonly itemKey: string
  /** NEO vào đồ thị năng lực. ≥1 slug. */
  readonly skills: readonly Slug[]
  /** Prior do người soạn; sau trôi theo cộng đồng (Elo item). */
  readonly difficulty: Elo
  /** Luyện tập vs bài đo. Mặc định LEARN. */
  readonly mode?: AssessmentMode
  /** true → thành Candidate + sinh Observation. Mặc định lấy từ registry theo primitiveKind. */
  readonly measurable?: boolean
  /** = quiz type / AuthorableKind của @bingoo.ai/core → chính là Candidate.kind (thẻ định dạng). */
  readonly primitiveKind: string
  /** Bài/lesson chứa item — cho ưu tiên "củng cố bài đã dạy". */
  readonly lessonSlug?: Slug
  /** Primitive Zod của @bingoo.ai/core (single/fill/…); hộp đen với engine. */
  readonly payload: unknown
}

/** Hàm chấm host cấp (thật: `gradeQuestion` của @bingoo.ai/core — xem grade.ts `quizGrader`). */
export type Grader = (payload: unknown, response: unknown) => Grade

// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * KẾ HOẠCH PHÂN CẤP — Khoá → Unit → Bài. Tầng TRÊN của Instruction Plan.
 *
 * Lý do tồn tại: sinh kế hoạch BÀI mà chỉ thấy vài KC rời thì LLM không hiểu tổng thể → bịa và mất
 * tính sư phạm. Kế hoạch cấp trên (đã DUYỆT) là CONTEXT chảy xuống, và là CỔNG (chưa duyệt cha thì
 * không sinh con). Các doc dưới đây cố ý GIÁO HỌC CHI TIẾT: đủ để một người soạn/LLM cấp dưới hiểu ý
 * đồ, không phải chỉ vài dòng.
 */

import type { Slug } from '@bingoo.ai/knowledge-engine'
import type { LocalizedText } from './model'

/** Tóm tắt một unit trong kế hoạch khoá — vừa làm context, vừa để kiểm coverage. */
export interface CourseUnitBrief {
  readonly slug: Slug
  readonly title: LocalizedText
  /** Trọng tâm unit (một câu). */
  readonly focus: LocalizedText
  /** KC/mục tiêu unit này gánh (⊆ objectives của khoá). */
  readonly objectives: readonly Slug[]
  /** Thứ tự unit trong khoá (0-based) — trình tự sư phạm, không tuỳ tiện. */
  readonly order: number
}

/** KẾ HOẠCH KHOÁ — mục tiêu tổng thể + tiếp cận sư phạm + trình tự unit + chiến lược đánh giá. */
export interface CoursePlanDoc {
  readonly courseSlug: Slug
  readonly title: LocalizedText
  /**
   * BIG IDEA của cả khoá — ý hiểu bền vững, xuyên suốt mà toàn khoá xây nên (không phải nhãn chủ đề).
   * Đây là "ý định sư phạm" → author. Xem [[plan-derive-vs-author]].
   */
  readonly bigIdea?: LocalizedText
  /** TRANSFER GOAL của khoá — người học DÙNG được vào tình huống MỚI nào sau cả khoá (far transfer). */
  readonly transferGoal?: LocalizedText
  /** Mục tiêu tổng thể của khoá (học xong đạt được gì). */
  readonly goals: readonly LocalizedText[]
  /** Chuẩn đầu ra đo được ("người học có thể…"). */
  readonly outcomes: readonly LocalizedText[]
  /** Tiếp cận sư phạm chủ đạo (vd CPA, inquiry, mastery, spiral…) + lý do hợp với môn/đối tượng. */
  readonly approach: LocalizedText
  /** Vì sao trình tự các unit như vậy (mạch tiên quyết, độ khó tăng dần…). */
  readonly sequenceRationale: LocalizedText
  /** Chiến lược đánh giá toàn khoá (hình thành/tổng kết, mốc, tỉ trọng). */
  readonly assessmentStrategy: LocalizedText
  /** Đối tượng & điều kiện tiên quyết của khoá. */
  readonly audience?: LocalizedText
  readonly units: readonly CourseUnitBrief[]
}

/** Vai trò một bài trong mạch của unit — làm context cho sinh kế hoạch bài. */
export interface UnitLessonBrief {
  readonly slug: Slug
  readonly title: LocalizedText
  /** Vai trò của bài trong mạch unit (dẫn nhập / xây khái niệm / luyện sâu / tổng hợp…). */
  readonly role: LocalizedText
  /** KC bài dạy. */
  readonly teaches: readonly Slug[]
  readonly durationMin?: number
  readonly order: number
}

/** KẾ HOẠCH UNIT — mạch học của unit + các bài xây lên nhau + đánh giá unit + tiêu chí đạt. */
export interface UnitPlanDoc {
  readonly unitSlug: Slug
  readonly courseSlug: Slug
  readonly title: LocalizedText
  /**
   * BIG IDEA — cái HIỂU bền vững, chuyển giao được mà unit xây nên (không phải nhãn chủ đề, không phải
   * chép lại tiêu đề). Đây là "ý định sư phạm" chưa ghi ở đâu → phải author. Xem [[transfer-goal]].
   */
  readonly bigIdea?: LocalizedText
  /** ESSENTIAL QUESTION — câu hỏi mở, khơi tìm tòi, dẫn dắt xuyên unit (tuỳ chọn). */
  readonly essentialQuestion?: LocalizedText
  /** Mạch học của unit: các bài nối nhau thế nào để đạt mục tiêu unit. */
  readonly arc: LocalizedText
  /** Mục tiêu của unit. */
  readonly objectives: readonly LocalizedText[]
  /**
   * TRANSFER GOAL — người học DÙNG được vào tình huống MỚI/lạ nào (far transfer), diễn đạt như một
   * performance cụ thể. Khác facet transfer (facet chỉ phân loại) — đây là đích hành động.
   */
  readonly transferGoal?: LocalizedText
  /** Trình tự bài + vai trò từng bài. */
  readonly lessons: readonly UnitLessonBrief[]
  /** Chiến lược đánh giá unit. */
  readonly assessmentStrategy: LocalizedText
  /** Tiêu chí "đạt unit". */
  readonly successCriteria: readonly LocalizedText[]
  // GHI CHÚ: prerequisites KHÔNG author ở đây — được DERIVE từ competency graph (tiên quyết của các KC
  // trong unit mà unit không tự dạy). Xem plan-insights.service.
}

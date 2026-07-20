/**
 * Instruction Plan — khung CHUẨN, dùng chung, versioned (CONTENT-ARCHITECTURE §4–§5).
 * KHÔNG chứa presentation (que tính/kịch bản) hay story theme — đó là tầng Content (per-persona).
 * Mọi trường neo vào đồ thị năng lực bằng slug. KP là nguyên tử dạy của một bài.
 */

import type { Slug } from '@bingoo.ai/knowledge-engine'

export type LocalizedText = Readonly<Record<string, string>>

/** Điểm sai thường gặp — seed cho distractor; gắn ĐÚNG một KC. */
export interface Misconception {
  readonly id: string
  readonly type: 'conceptual' | 'procedural' | 'incomplete' | 'formatting'
  readonly wrong: LocalizedText
  readonly targetsKc: Slug
  readonly diagnostic?: LocalizedText
  readonly remediation?: LocalizedText
}

/** Cách trình bày Cụ thể → Hình → Trừu tượng — seed cho explainer/worked-example. */
export interface Representation {
  readonly stage: 'concrete' | 'pictorial' | 'abstract'
  readonly model: LocalizedText
  readonly note?: LocalizedText
}

/** Tiêu chí "em làm được" (đo được). */
export interface SuccessCriterion {
  readonly text: LocalizedText
  readonly kc?: Slug
}

/** Chiến lược gợi ý — chỉ khai BẬC (nội dung sinh ở Content). */
export interface HintStrategy {
  readonly levels: readonly string[]
}

/** Knowledge Point — đơn vị DẠY, trỏ tới ≥1 KC + mang pedagogy. */
export interface KnowledgePoint {
  readonly slug: Slug
  readonly version: number
  readonly targets: readonly Slug[]
  readonly prereqKpIds?: readonly string[]
  readonly misconceptions: readonly Misconception[]
  readonly representations: readonly Representation[]
  readonly successCriteria: readonly SuccessCriterion[]
  readonly hintStrategy?: HintStrategy
  /** Khoá feedback (correct/almost/mc-*) — lời văn sinh ở Content. */
  readonly feedbackKeys?: readonly string[]
}

/** Hoạt động (intent) — chọn LOẠI primitive cho khái niệm nào; chưa có payload. */
export interface ActivityPlan {
  readonly slug: Slug
  readonly purpose: 'teach' | 'practice' | 'assess'
  readonly primitiveKinds: readonly string[]
  readonly concepts: readonly Slug[]
  readonly difficultyBand?: 'easy' | 'core' | 'stretch'
  readonly itemCount?: number
}

export interface BlueprintEntry {
  readonly concept: Slug
  readonly itemCount: number
  readonly difficulty?: 'easy' | 'core' | 'stretch'
  readonly primitiveKind?: string
}

/** Tiêu chí rubric (mô tả mức) — seed cho grader rubric. */
export interface PlanRubricCriterion {
  readonly criterion: LocalizedText
  readonly weight: number
  readonly levels: readonly string[]
}

/** Blueprint bài đo — dùng chung mọi level; chuẩn/cut cố định. */
export interface AssessmentPlan {
  readonly slug: Slug
  readonly mode: 'LEARN' | 'MEASURE'
  readonly objectives: readonly Slug[]
  readonly blueprint: readonly BlueprintEntry[]
  readonly cut?: number
  readonly passRatio?: number
  readonly proctored?: boolean
  readonly rubric?: readonly PlanRubricCriterion[]
}

/**
 * Cách một BƯỚC được lấp bằng nội dung gì — quyết định generator nào chạy cho bước:
 *   explainer  → uỷ cho HỆ EXPLAINER (nhiều cảnh, tương tác bên trong); `durationMin` → targetMinutes.
 *   content    → block đọc/xem (exposition, measurable=false).
 *   practice   → item luyện (quiz, chưa vào bằng chứng chính thức).
 *   assessment → bài đo (quiz measurable → Candidate/evidence).
 *   reflection → suy ngẫm/tổng kết, không sinh item.
 */
export type StepDeliveryKind = 'explainer' | 'content' | 'practice' | 'assessment' | 'reflection'

/**
 * TRẠNG THÁI người học với MỘT KC — taxonomy ĐÓNG (Decision Engine suy ĐỘNG từ Learner Model: mastery +
 * fluency), khác `role` (mở). Plan mã hoá "bước này phục vụ trạng thái nào" → khi vào học, engine chọn
 * đúng NHÁNH cho người đó. Đây là thứ biến plan tĩnh thành nền adaptive.
 *   novice     — chưa biết gì (mastery≈0): cần nguyên arc từ concrete.
 *   gap        — biết rồi nhưng hổng / giữ hiểu-sai: chẩn đoán → vá đúng chỗ → đo.
 *   proficient — khá (mastery cao, chưa automatic): nén dạy → apply/transfer/challenge.
 *   mastered   — đã thạo: chỉ truy hồi giãn cách, không dạy lại.
 */
export type LearnerState = 'novice' | 'gap' | 'proficient' | 'mastered'

/**
 * Một BƯỚC trong chuỗi dạy của MỘT KC.
 *
 * VAI TRÒ (`role`) để MỞ (hook, recall, objectives, explore, teach, guided-practice, practice,
 * challenge, assessment, feedback, summary, apply, …) — PLAN tự chọn bước nào, thứ tự nào, mấy phút,
 * theo tư duy sư phạm cho ĐÚNG KC này & đối tượng này. KHÔNG cố định một luồng cứng.
 *
 * Bước KHÔNG mang `targets`: nó thuộc về đúng một KC (KC của arc chứa nó). Gộp nhiều KC vào một bước
 * là DẠY HỜI HỢT — mỗi KC bị rút ngắn. Nên mỗi KC có chuỗi bước riêng (xem KcArc).
 */
export interface LessonStep {
  readonly slug: Slug
  /** Vai trò sư phạm — chuỗi MỞ, không enum cứng. */
  readonly role: string
  readonly title: LocalizedText
  /** Vì sao có bước này (ý đồ sư phạm) — cho người soạn + generator hiểu. */
  readonly intent?: LocalizedText
  /** Thời lượng dự kiến (phút) — PLAN quyết, kể cả cho explainer (→ targetMinutes). */
  readonly durationMin: number
  readonly deliveryKind: StepDeliveryKind
  /**
   * Bước này phục vụ TRẠNG THÁI người học nào. VẮNG/RỖNG = phục vụ MỌI trạng thái (nhánh mặc định, đi
   * đủ cho người chưa biết). Có giá trị = chỉ hiện cho người ở trạng thái đó (vd chỉ 'gap' cho bước vá
   * hiểu-sai; chỉ 'proficient' cho bước thử thách). Decision Engine dùng để chọn nhánh khi render.
   */
  readonly forStates?: readonly LearnerState[]
  /**
   * BRIEF NỘI DUNG chi tiết — generator BÁM vào đây để KHÔNG sinh chung chung. Nói CỤ THỂ bước này
   * dạy/hỏi/trình bày cái gì cho KC của nó: ví dụ dùng gì, tình huống nào, chốt ở đâu. Chung chung
   * ("giới thiệu phép cộng") là hỏng; phải cụ thể ("dùng ten-frame gộp 7+5, nhấn bước tràn chục").
   */
  readonly brief?: LocalizedText
  /** Những ĐIỂM/NHIỆM VỤ cụ thể nội dung PHẢI có (worked example, dạng bài, sai lầm cần chặn…). */
  readonly mustCover?: readonly LocalizedText[]
  /**
   * Loại primitive gợi ý cho bước: practice/assessment → quiz kinds; content → block kinds;
   * explainer → interactive/manipulative kinds nhúng trong cảnh. Rỗng = để generator tự chọn.
   */
  readonly primitiveKinds?: readonly string[]
  readonly itemCount?: number
  readonly band?: 'easy' | 'core' | 'stretch'
}

/**
 * Chuỗi bước dạy TRỌN VẸN cho MỘT KC.
 *
 * Nguyên tắc: một bài có nhiều KC thì CHIA & QUẢN LÝ THEO TỪNG KC — mỗi KC một arc riêng, mỗi arc là
 * một chuỗi bước đầy đủ (mở → khơi gợi → khám phá → dạy → luyện → đánh giá → tổng kết, tuỳ KC). KHÔNG
 * gộp nhiều KC vào chung bước: gộp = tham = rút ngắn việc học của từng KC. Các arc XẾP THEO TIÊN QUYẾT
 * (KC nền trước KC phụ thuộc).
 */
export interface KcArc {
  readonly kc: Slug
  /** Nhãn phần này (mặc định = tiêu đề KC). */
  readonly title?: LocalizedText
  readonly steps: readonly LessonStep[]
  /**
   * NGƯỠNG THOÁT KC — đạt thì mới lên level / chuyển KC (Decision Engine đọc). `masteryMin` ∈ [0,1];
   * `fluencyMin` là bậc fluency tối thiểu (emerging→automatic, để chuỗi khỏi phụ thuộc @bingoo.ai/facets).
   * Vắng = dùng ngưỡng mặc định của policy engine.
   */
  readonly exit?: {
    readonly masteryMin?: number
    readonly fluencyMin?: 'emerging' | 'accurate' | 'fluent' | 'automatic'
  }
}

/** Giáo án bài (Instruction) — gồm KP + CẤU TRÚC theo từng KC (kcArcs) + hoạt động + bài đo. */
export interface LessonInstructionPlan {
  readonly slug: Slug
  readonly version: number
  readonly pedagogyVersion?: string
  readonly title: LocalizedText
  readonly teaches: readonly Slug[]
  readonly prerequisites?: readonly Slug[]
  readonly outcomes?: readonly SuccessCriterion[]
  readonly knowledgePoints: readonly KnowledgePoint[]
  /** CẤU TRÚC bài = mỗi KC một chuỗi bước riêng, xếp theo tiên quyết. Trống = chưa dựng cấu trúc. */
  readonly kcArcs?: readonly KcArc[]
  readonly activities?: readonly ActivityPlan[]
  readonly assessment?: AssessmentPlan
}

export interface UnitPlan {
  readonly slug: Slug
  readonly version: number
  readonly title: LocalizedText
  readonly concepts: readonly Slug[]
  readonly lessons: readonly LessonInstructionPlan[]
}

export interface CoursePlan {
  readonly slug: Slug
  readonly title: LocalizedText
  readonly curriculumVersion?: string
  readonly frameworkVersionId?: string
  readonly objectives: readonly Slug[]
  readonly units: readonly UnitPlan[]
}

/**
 * Kiểu dữ liệu biên (data contracts) — các hình dạng đi qua cổng adapter.
 *
 * Đây chỉ là khai báo kiểu thuần (không logic), là hợp đồng ổn định giữa host và engine.
 * Lõi thuật toán (M1+) có thể tinh chỉnh kiểu nội bộ, nhưng các kiểu ở đây là biên bền.
 */

import type {
  AssessmentMode,
  CompetencyKind,
  DreyfusLevel,
  EvidenceActor,
  EvidenceSource,
  ObservationSubject,
  PrereqMode,
  RelType,
} from './domain'

/** Khoá tham chiếu khái niệm (SPEC: engine chạy bằng slug). */
export type Slug = string
/** Điểm Elo (ability của người học / difficulty của đối tượng). */
export type Elo = number
/** Mốc thời gian epoch milliseconds — thời gian LUÔN truyền vào, lõi không đọc đồng hồ. */
export type Millis = number

export type Awaitable<T> = T | Promise<T>

/** SPEC Phụ lục A.1 — node đồ thị (title đa ngữ; parent = taxonomy, KHÔNG phải prereq). */
export interface SkillNode {
  readonly slug: Slug
  readonly title: Readonly<Record<string, string>>
  readonly kind: CompetencyKind
  readonly parent?: Slug
  readonly level?: number
  /**
   * Phân đoạn chương trình (vd "Stage 1", "Lớp 3"). Engine KHÔNG đọc — host bền hoá + lọc theo nó
   * (sách Stage 1 chỉ được neo vào KC Stage 1). Thiếu stage thì không map được sách vào đúng phần khung.
   */
  readonly stage?: string
  /** Mạch kiến thức (vd "Number", "Geometry and Measure"). Engine KHÔNG đọc; để nhóm/lọc. */
  readonly strand?: string
  /** Môn/ngành (vd "math", "language", "welding"). Engine KHÔNG đọc — chỉ host dùng để chọn DomainProfile. */
  readonly subject?: string
  /**
   * FACETS — 6 trục phân biệt KC (@bingoo.ai/facets). ĐỤC với engine: engine KHÔNG BAO GIỜ đọc field này.
   * Nó tồn tại để tầng biên soạn quyết định ĐỊNH DANH bằng cấu trúc thay vì so chuỗi (xem invariants).
   * Để opaque ở đây nhằm giữ engine không phụ thuộc package nào.
   */
  readonly facets?: Readonly<Record<string, unknown>>
}

/** SPEC Phụ lục A.1 — cạnh đồ thị (relType mặc định PREREQUISITE). */
export interface SkillEdge {
  readonly from: Slug
  readonly to: Slug
  readonly mode: PrereqMode
  readonly relType?: RelType
  readonly weight?: number
}

/** SPEC Phụ lục B.7 — dữ liệu thô để dựng đồ thị in-memory (A.2). */
export interface GraphData {
  readonly nodes: readonly SkillNode[]
  readonly edges: readonly SkillEdge[]
}

/** SPEC §1.6 — view mức nắm hiện tại (materialized). lastSeenMs dùng thay lastSeenAt. */
export interface SkillStateView {
  readonly userId: string
  readonly skillSlug: Slug
  readonly pKnown: number
  readonly ability: Elo
  readonly attempts: number
  readonly correct: number
  readonly fluency?: number
  readonly transfer?: number
  readonly independence?: number
  readonly level?: DreyfusLevel
  readonly lastSeenMs?: Millis | null
}

/** SPEC §1.7 — mẫu chuỗi thời gian (vẽ đường cong học). */
export interface SkillSnapshot {
  readonly skillSlug: Slug
  readonly pKnown: number
  readonly ability: Elo
  readonly level?: DreyfusLevel
  readonly atMs: Millis
}

/** SPEC §B.1 — ứng viên trừu tượng để engine chọn (nội dung là hộp đen). */
export interface Candidate {
  readonly key: string
  readonly skills: readonly Slug[]
  readonly difficulty: Elo
  /** SPEC §B.1 — thẻ ĐỊNH DẠNG (free-form) cho declump/cap §8.3; KHÔNG phải CompetencyKind. */
  readonly kind?: string
  /** Bài/lesson chứa ứng viên — cho ưu tiên "củng cố bài đã dạy" (SPEC §8.2). */
  readonly lessonSlug?: Slug
}

/** SPEC §5 — tiêu chí rubric. */
export interface RubricCriterion {
  readonly score: number
  readonly max: number
  readonly weight?: number
}

/** BỔ SUNG §3.3 + §9.1 — bài nộp cần chấm (attemptId = khoá idempotency). */
export interface Submission {
  readonly attemptId: string
  readonly skills: readonly Slug[]
  readonly payload: unknown
  readonly itemKey?: string
  readonly latencyMs?: number
  readonly hintsUsed?: number
  readonly lang?: string
  /** Mốc thời gian tương tác (cho lãng quên §3.2). Host truyền vào; lõi không đọc đồng hồ. */
  readonly atMs?: Millis
}

/** BỔ SUNG §3.3 — kết quả chấm (grader tự khai confidence). */
export interface Verdict {
  readonly outcome: number
  readonly confidence: number
  readonly rubric?: readonly RubricCriterion[]
  readonly flags?: readonly string[]
}

/** BỔ SUNG §3.2 — hồ sơ người chấm (calibration hiệu chuẩn theo lịch sử). */
export interface RaterProfile {
  readonly raterId: string
  readonly role: EvidenceActor
  readonly calibration: number
  readonly volume: number
}

/**
 * Đầu vào fold một bằng chứng — SPEC §0 `Observation` + BỔ SUNG §3 (actor/proctored).
 * `outcome` HOẶC `correct` phải có; các trường còn lại tuỳ chọn.
 */
export interface EvidenceInput {
  readonly skill: Slug
  readonly correct?: boolean
  readonly outcome?: number
  readonly confidence?: number
  readonly difficulty?: Elo
  readonly latencyMs?: number
  readonly hintsUsed?: number
  /** EVIDENCE-ANALYTICS §2.1 — số lần thử lại (analytics/tín hiệu bền bỉ). */
  readonly retry?: number
  readonly atMs?: Millis
  readonly kind?: CompetencyKind
  readonly source?: EvidenceSource
  readonly mode?: AssessmentMode
  readonly itemKey?: string
  readonly lang?: string
  /** BỔ SUNG §3.1 — chủ thể ghi (host cấp từ RBAC). */
  readonly actor: EvidenceActor
  /** BỔ SUNG §3.2 — người chấm cụ thể (để tra RaterProfile). */
  readonly raterId?: string
  /** BỔ SUNG §3.1 — phiên đo hợp lệ (điều kiện cho mode=MEASURE của learner). */
  readonly proctored?: boolean
  /** SPEC §1.5 — lane bằng chứng; chỉ LEARNER fold vào SkillState (B2). Mặc định LEARNER. */
  readonly subjectType?: ObservationSubject
  /** BỔ SUNG §9.1 — khoá idempotency (từ Submission.attemptId). */
  readonly attemptId?: string
  /** EVIDENCE-ANALYTICS §2.1 — provenance cấp KP (không đổi cách fold; vẫn fold theo skillSlug). */
  readonly knowledgePointId?: string
}

/** SPEC §7.3/§B.5 — một tiên quyết của đơn vị có thể khoá. */
export interface PrerequisiteRef {
  readonly requiredType: 'COMPETENCY' | 'LESSON'
  readonly requiredId: string
  readonly mode: PrereqMode
}

/** SPEC §6.5/§B.4 — neo năng lực cho rollup (tham chiếu bằng id ổn định). */
export interface CompetencyAnchor {
  readonly competencyId: string
  readonly weight: number
}

/** SPEC §7.5/§B.3 — hạt giống scope liên quan (engine tự mở rộng một-hop). */
export interface RelevanceSeeds {
  readonly taughtSlugs: readonly Slug[]
  readonly startedLessonSlugs: readonly Slug[]
}

/** SPEC §B.6 — thống kê độ khó đối tượng theo cộng đồng (tuỳ chọn). */
export interface ItemStat {
  readonly difficulty: Elo
  readonly attempts: number
  readonly correct: number
}

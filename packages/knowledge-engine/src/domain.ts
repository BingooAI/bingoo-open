/**
 * Enums miền — SPEC §1.1 + BỔ SUNG §3.
 *
 * Dùng string literal union (không `enum`) cho lõi thuần: idiomatic, tương thích
 * `isolatedModules`/`verbatimModuleSyntax`, và tham chiếu ổn định bằng chuỗi (bất biến B5).
 */

/** SPEC §1.1 — phân loại node năng lực. */
export type CompetencyKind =
  'OBJECTIVE' | 'OUTCOME' | 'SKILL' | 'KNOWLEDGE' | 'PROCEDURE' | 'BEHAVIOR' | 'ATTITUDE' | 'DISPOSITION'

/** Kind học được (SPEC §7 LEARNABLE_KINDS mở rộng cho BEHAVIOR/ATTITUDE do supporter ghi). */
export const LEARNABLE_KINDS = ['KNOWLEDGE', 'SKILL', 'DISPOSITION'] as const

/** SPEC §1.1 — REQUIRED chặn truy cập; RECOMMENDED chỉ cảnh báo. */
export type PrereqMode = 'REQUIRED' | 'RECOMMENDED'

/** SPEC §1.1/§1.3 — kiểu cạnh. Ba loại đầu là ordering (DAG); ba loại sau là lateral. */
export type RelType = 'PREREQUISITE' | 'ENABLES' | 'COMPOSES' | 'ALIGNS' | 'VARIANT_OF' | 'MAPS_TO'

/** SPEC Phụ lục A.1 — cạnh ordering giữ acyclic; traversal ordering không vấp lateral. */
export const ORDERING_RELS = ['PREREQUISITE', 'ENABLES', 'COMPOSES'] as const

export function isOrdering(rel: RelType | undefined): boolean {
  return (ORDERING_RELS as readonly string[]).includes(rel ?? 'PREREQUISITE')
}

export type FrameworkKind = 'CURRICULUM' | 'CREDENTIAL' | 'JOB_PROFILE'
export type FrameworkReleaseType = 'PATCH' | 'MINOR' | 'MAJOR'
export type FrameworkVersionStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED'

/** SPEC §1.1 — nguồn bằng chứng. */
export type EvidenceSource = 'QUIZ' | 'PROJECT' | 'RUBRIC' | 'PEER' | 'OBSERVATION' | 'TIME'

/** SPEC §1.1 — chỉ LEARNER fold vào SkillState (bất biến B2). */
export type ObservationSubject = 'LEARNER' | 'TEACHER' | 'CURRICULUM'

/** SPEC §1.1 — LEARN có gợi ý; MEASURE khoá, không gợi ý (dùng cho chứng chỉ). */
export type AssessmentMode = 'LEARN' | 'MEASURE'

/** SPEC §4.2 — bậc Dreyfus dẫn xuất. */
export type DreyfusLevel = 'novice' | 'competent' | 'proficient' | 'expert'

/** BỔ SUNG §3.1 — chủ thể ghi bằng chứng (host map user→actor qua RBAC). */
export type EvidenceActor = 'LEARNER_SELF' | 'TEACHER' | 'SUPPORTER' | 'PEER' | 'ASSESSOR' | 'SYSTEM'

export const EVIDENCE_ACTORS = ['LEARNER_SELF', 'TEACHER', 'SUPPORTER', 'PEER', 'ASSESSOR', 'SYSTEM'] as const

// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Enums miền — SPEC §1.1 + BỔ SUNG §3.
 *
 * Mười một enum dưới đây được TÁI XUẤT từ `@bingoo.ai/contracts`, không định nghĩa lại.
 * Trình biên dịch đã xác nhận chúng bằng nhau ở CẢ HAI CHIỀU, nên đây là gộp nguồn sự thật
 * chứ không phải đổi kiểu.
 *
 * Tái xuất bằng `export type` là có chủ ý: nó bị xoá lúc biên dịch, nên package này vẫn
 * KHÔNG có phụ thuộc runtime nào — engine chạy được trong trình duyệt mà không kéo theo zod.
 * Cái giá: ba hằng số bên dưới vẫn là bản sao, và được test canh cho khỏi trôi.
 */

import type {
  AssessmentMode,
  CompetencyKind,
  DreyfusLevel,
  EvidenceActor,
  EvidenceSource,
  FrameworkKind,
  FrameworkReleaseType,
  FrameworkVersionStatus,
  ObservationSubject,
  PrereqMode,
  RelType,
} from '@bingoo.ai/contracts'

export type {
  AssessmentMode,
  CompetencyKind,
  DreyfusLevel,
  EvidenceActor,
  EvidenceSource,
  FrameworkKind,
  FrameworkReleaseType,
  FrameworkVersionStatus,
  ObservationSubject,
  PrereqMode,
  RelType,
}

/** Kind học được (SPEC §7 LEARNABLE_KINDS mở rộng cho BEHAVIOR/ATTITUDE do supporter ghi). */
export const LEARNABLE_KINDS = ['KNOWLEDGE', 'SKILL', 'DISPOSITION'] as const

/** SPEC Phụ lục A.1 — cạnh ordering giữ acyclic; traversal ordering không vấp lateral. */
export const ORDERING_RELS = ['PREREQUISITE', 'ENABLES', 'COMPOSES'] as const

export function isOrdering(rel: RelType | undefined): boolean {
  return (ORDERING_RELS as readonly string[]).includes(rel ?? 'PREREQUISITE')
}

export const EVIDENCE_ACTORS = ['LEARNER_SELF', 'TEACHER', 'SUPPORTER', 'PEER', 'ASSESSOR', 'SYSTEM'] as const

/**
 * Kind đo bằng TẦN SUẤT tích luỹ (Beta-Binomial), không đo lượng còn nhớ.
 *
 * Bản sao rút gọn của `methodFor` bên `@bingoo.ai/contracts` — chỉ giữ đúng câu hỏi engine cần
 * hỏi, và giữ ở dạng hằng số vì gọi `methodFor` sẽ kéo contracts (và zod) thành phụ thuộc
 * runtime. Test contracts-alignment canh cho hai bên không trôi khỏi nhau.
 *
 * Hai chỗ dùng, cả hai đều là chuyện đúng/sai chứ không phải chỉnh tham số:
 * — lịch ôn: "quên" không áp cho tần suất (xem `halfLifeByKind`);
 * — báo cáo: một tần suất mỏng không được in ra thành điểm số (xem `views/gap`).
 */
export const FREQUENCY_KINDS = ['DISPOSITION', 'BEHAVIOR', 'ATTITUDE'] as const

export function isFrequencyMeasured(kind: CompetencyKind): boolean {
  return (FREQUENCY_KINDS as readonly string[]).includes(kind)
}

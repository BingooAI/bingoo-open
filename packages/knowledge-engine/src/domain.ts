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

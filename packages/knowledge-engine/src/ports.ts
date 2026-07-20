// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Cổng adapter — SPEC Phụ lục B (7 cổng) + BỔ SUNG §3.2, §3.3 (2 cổng).
 *
 * Engine CHỈ định nghĩa interface; host cấp adapter cụ thể (đọc DB, gọi grader…).
 * Mỗi cổng là truy vấn thuần với engine — host lưu trữ thế nào tuỳ ý. Trả `Awaitable`
 * vì host có thể I/O; engine nạp full vào RAM rồi chạy các hàm thuần (SPEC Phụ lục D.3).
 */

import type {
  Awaitable,
  Candidate,
  CompetencyAnchor,
  GraphData,
  ItemStat,
  PrerequisiteRef,
  RaterProfile,
  RelevanceSeeds,
  Slug,
  Submission,
  Verdict,
} from './contracts'

/** B.7 — nguồn đồ thị (mọi Competency + CapabilityRelation). Dựng graph in-memory ở A.4. */
export interface GraphSourcePort {
  loadGraph(): Awaitable<GraphData>
}

/** B.1 — nguồn ứng viên. `scope` do host định nghĩa (khoá học / lứa tuổi…). */
export interface CandidatePort<Scope = unknown> {
  candidates(scope: Scope): Awaitable<readonly Candidate[]>
}

/** B.2 — tập kỹ năng học viên "đã gặp" (chặn luyện-trước-khi-học, SPEC §8.2). */
export interface EncounteredPort {
  encountered(learnerId: string): Awaitable<ReadonlySet<Slug>>
}

/** B.3 — hạt giống scope liên quan (engine mở rộng một-hop, SPEC §7.5). */
export interface RelevanceScopePort {
  relevanceSeeds(learnerId: string): Awaitable<RelevanceSeeds>
}

/** B.4 — neo năng lực cho một đích rollup (nhóm / khoá / chương trình). */
export interface CompetencyAnchorPort {
  anchors(targetId: string): Awaitable<readonly CompetencyAnchor[]>
}

/** B.5 — tiên quyết cho một đơn vị có thể khoá (SPEC §7.3). */
export interface PrerequisitePort {
  prerequisites(unitId: string): Awaitable<readonly PrerequisiteRef[]>
}

/** B.6 — kho độ khó đối tượng theo cộng đồng (TUỲ CHỌN; thiếu → observe lấy ability). */
export interface ItemStatPort {
  itemStat(itemKey: string): Awaitable<ItemStat | null>
}

/** BỔ SUNG §3.2 — hồ sơ người chấm (null → dùng mặc định theo role). */
export interface RaterProfilePort {
  raterProfile(raterId: string): Awaitable<RaterProfile | null>
}

/** BỔ SUNG §3.3 — grader sản xuất Verdict từ Submission (hiện thực NGOÀI lõi). */
export interface GraderPort {
  grade(submission: Submission): Awaitable<Verdict>
}

/**
 * Gộp toàn bộ cổng host cần cấp để engine chạy đầy đủ.
 * Cổng tuỳ chọn (`itemStat`) có thể bỏ; các cổng khác bắt buộc theo tính năng dùng đến.
 */
export interface EnginePorts<Scope = unknown> {
  readonly graph: GraphSourcePort
  readonly candidates: CandidatePort<Scope>
  readonly encountered: EncounteredPort
  readonly relevance: RelevanceScopePort
  readonly anchors: CompetencyAnchorPort
  readonly prerequisites: PrerequisitePort
  readonly itemStat?: ItemStatPort
  readonly raters: RaterProfilePort
  readonly grader: GraderPort
}

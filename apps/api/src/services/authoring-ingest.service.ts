// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * S2 — biên khung năng lực: nguồn thô (PDF/ảnh/text) → (LLM) đồ thị KC ứng viên → compile + validate.
 * DỪNG ở "cần duyệt" (KHÔNG auto-persist). Người duyệt xong mới applyAuthoredGraph (workflow S1→S7).
 */

import {
  compileDraft,
  hasBlockingIssue,
  runIngest,
  validateDraft,
  type CompiledFramework,
  type DraftIssue,
  checkInvariants,
  hasBlockingViolation,
  type RawSource,
} from '@bingoo.ai/authoring'
import { buildAuthoringPorts } from './authoring-adapters'
import { describeCollisions, type CollisionView } from './authoring-framework.service'
import { loadDomainProfiles, loadExistingConcepts, loadExistingNodes } from '../repos/authoring.repo'

export interface IngestResult {
  readonly compiled: CompiledFramework
  readonly issues: readonly DraftIssue[]
  /**
   * Cảnh báo từ pipeline (vd "bỏ cạnh X→Y vì không khớp khái niệm nào").
   * TRƯỚC ĐÂY BỊ NUỐT — và đó là lý do đồ thị mất sạch cạnh tiên quyết suốt 3 lần chạy mà không
   * ai biết. Cảnh báo không được phơi ra thì bằng không có.
   */
  readonly warnings: readonly string[]
  /**
   * Vi phạm BẤT BIẾN — xem TRƯỚC khi ghi.
   * Trước đây chỉ biết lúc /apply ném lỗi: người soạn chờ LLM chạy xong, bấm Duyệt, rồi mới bị chặn.
   * Phải hiện ngay ở bước sinh thì mới sửa được.
   */
  readonly violations: readonly {
    code: string
    severity: string
    message: string
    slugs: string[]
  }[]
  /**
   * Chỗ máy KHÔNG PHÂN BIỆT ĐƯỢC hai kiến thức, kèm so-từng-trục để người duyệt chốt.
   *
   * Vi phạm I1 đã có trong `violations`, nhưng ở đó nó là một dòng chữ. Người duyệt cần biết TRỤC
   * NÀO trùng — đó vừa là lý do máy bí, vừa là chỗ họ phải bổ sung nếu hai cái thật sự khác nhau.
   */
  readonly collisions?: readonly CollisionView[]
  /** Có lỗi chặn (issue HOẶC vi phạm bất biến) → chưa được phép áp vào đồ thị. */
  readonly blocking: boolean
}

export async function ingestSource(
  source: RawSource,
  opts?: { aiKey?: string; embeddingKey?: string; threshold?: number },
): Promise<IngestResult> {
  const ports = buildAuthoringPorts(opts)
  const draft = await runIngest(source, ports)
  const existing = await loadExistingConcepts()
  const compiled = compileDraft(draft, existing, opts?.threshold)
  const issues = validateDraft(compiled)
  const [profiles, existing2] = await Promise.all([loadDomainProfiles(), loadExistingNodes()])
  const violations = checkInvariants(compiled.graph, { profiles, existing: existing2 })
  return {
    compiled,
    issues,
    warnings: draft.warnings,
    violations: violations.map((v) => ({
      code: v.code,
      severity: v.severity,
      message: v.message,
      slugs: [...v.slugs],
    })),
    collisions: describeCollisions(compiled.graph, violations),
    blocking: hasBlockingIssue(issues) || hasBlockingViolation(violations),
  }
}

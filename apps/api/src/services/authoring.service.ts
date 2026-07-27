// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Authoring service — áp một đồ thị đã biên soạn/duyệt vào db, có CỔNG AN TOÀN dùng engine.
 * Chặn chu trình tiên quyết trước khi ghi (đồ thị phải là DAG). Sau ghi → invalidate cache graph.
 */

import {
  checkInvariants,
  hasBlockingViolation,
  type CompiledConcept,
  type CompiledObjective,
} from '@bingoo.ai/authoring'
import type { GraphData } from '@bingoo.ai/knowledge-engine'
import {
  loadDomainProfiles,
  loadExistingNodes,
  persistFramework,
  persistGraph,
  type FrameworkMeta,
  type FrameworkPersistResult,
  type PersistResult,
} from '../repos/authoring.repo'
import { indexKcEmbeddings } from '../repos/competency-embedding.repo'
import { invalidateGraphCache } from './knowledge.service'
import { AppError } from '../lib/errors'
import { writeClaimTraces, type WriteTraceResult } from './decision-trace.service'

/**
 * CỔNG BẤT BIẾN — chạy TOÀN BỘ bất biến (I1–I8) trước khi ghi, không chỉ kiểm chu trình.
 * Đây là chỗ chặn cả LỚP lỗi: trùng định danh KC, stage đặt nhầm lên KC, objective mồ côi,
 * MAPS_TO không REQUIRED (sẽ chứng nhận sai), thiếu title.en, thiếu facet bắt buộc, chu trình.
 * `error` = CHẶN. Ghi một đồ thị vi phạm là làm hỏng vĩnh viễn xương sống bằng chứng.
 */
async function assertInvariants(graph: GraphData): Promise<void> {
  const [profiles, existing] = await Promise.all([loadDomainProfiles(), loadExistingNodes()])
  const violations = checkInvariants(graph, { profiles, existing })

  if (hasBlockingViolation(violations)) {
    throw AppError.validation(
      violations
        .filter((v) => v.severity === 'error')
        .map((v) => ({ path: v.slugs.join(','), message: v.message, code: v.code })),
    )
  }
  for (const w of violations) {
    console.warn(`[invariant:${w.code}] ${w.message}`)
  }
}

/** Áp GraphData (đã duyệt) vào đồ thị năng lực. Ném nếu có chu trình ordering. */
export async function applyAuthoredGraph(graph: GraphData): Promise<PersistResult> {
  await assertInvariants(graph)
  const result = await persistGraph(graph)
  invalidateGraphCache()
  return result
}

export interface ApplyFrameworkResult extends PersistResult {
  readonly framework?: FrameworkPersistResult
  /** Thẻ căn cứ đã ghi. Vắng = không truyền tài liệu nguồn, nên không có gì để đối chiếu. */
  readonly traces?: WriteTraceResult
}

/** Áp trọn: đồ thị KC + (tuỳ chọn) Framework/FrameworkVersion/objectives + MAPS_TO. */
export async function applyAuthoredFramework(input: {
  graph: GraphData
  framework?: FrameworkMeta
  objectives?: readonly CompiledObjective[]
  /** Bằng chứng nguồn của kiến thức — đồ thị không chở được, nên nó đi đường riêng. */
  concepts?: readonly CompiledConcept[]
  /**
   * Tài liệu nguồn. CÓ thì mỗi khẳng định được đối chiếu lại vào đây và có thẻ căn cứ; KHÔNG có thì
   * khung vẫn ghi được nhưng không mục nào trả lời được "vì sao có nó" — và đó là sự thật, không
   * phải thiếu sót cần che.
   */
  source?: { readonly text: string; readonly storageKey?: string }
}): Promise<ApplyFrameworkResult> {
  await assertInvariants(input.graph)
  const result = await persistGraph(input.graph)
  const framework =
    input.framework && input.objectives
      ? await persistFramework(input.framework, input.objectives)
      : undefined

  /**
   * THẺ CĂN CỨ — ghi ngay khi áp, không để seed là chỗ duy nhất có.
   *
   * Trước đây `writeObjectiveTraces` chỉ được seed gọi, nên khung nào đi qua giao diện cũng ra một
   * đồ thị không có một dòng căn cứ nào: nút "Xem căn cứ" mở ra trống. Ghi ở đây nghĩa là BẤT KỲ
   * khung nào người dùng upload cũng có căn cứ, không riêng dữ liệu mẫu.
   */
  let traces: WriteTraceResult | undefined
  if (framework && input.source) {
    traces = await writeClaimTraces(
      framework.frameworkVersionId,
      {
        ...(input.objectives ? { objectives: input.objectives } : {}),
        ...(input.concepts ? { concepts: input.concepts } : {}),
        /**
         * CẠNH THỨ TỰ — thiếu chỗ này thì "vì sao học cái này trước" chỉ tồn tại ở dữ liệu mẫu.
         *
         * `writeClaimTraces` vốn nhận cạnh và dựng thẻ cho từng cạnh, nhưng đường duyệt chưa bao
         * giờ truyền vào; chỉ script seed truyền. Nên mọi khung người dùng tự nhập đều ra một đồ
         * thị có thứ tự học mà không một cạnh nào nói được vì sao nó nằm đúng chiều đó — đúng câu
         * hỏi khó nhất và đắt nhất trong cả ba.
         *
         * Lọc bỏ MAPS_TO: cạnh đó là "mục tiêu đo bằng mảnh nào", đã có loại thẻ riêng lo.
         */
        edges: input.graph.edges
          .filter((e) => (e.relType ?? 'PREREQUISITE') !== 'MAPS_TO')
          .map((e) => ({
            from: e.from as string,
            to: e.to as string,
            ...(e.relType !== undefined ? { relType: e.relType } : {}),
          })),
      },
      input.source.text,
      // Neo toạ độ cần file gốc; đường /apply chưa có bytes nên chỉ đối chiếu văn bản. Câu trích vẫn
      // được kiểm và vẫn tô "từ tài liệu" — chỉ chưa mở được đúng trang.
    )
  }

  // Nhúng KC vào chỉ mục NGỮ NGHĨA — khung ĐẦU TIÊN dựng vốn KC canonical, nên nếu không nhúng ở đây
  // thì khung THỨ HAI không có gì để truy hồi khi trigram bó tay (khác ngôn ngữ, khác cách diễn đạt).
  // Nhúng hỏng KHÔNG chặn ghi: chỉ mục là tiện ích truy hồi, không phải bất biến.
  try {
    await indexKcEmbeddings(
      input.graph.nodes
        .filter((n) => n.kind !== 'OBJECTIVE')
        .map((n) => {
          const object = (n.facets as { object?: string } | undefined)?.object
          return {
            slug: n.slug,
            title: n.title['en'] ?? Object.values(n.title)[0] ?? n.slug,
            ...(object ? { object } : {}),
          }
        }),
    )
  } catch {
    // im lặng — xem chú thích trên
  }

  invalidateGraphCache()
  return { ...result, ...(framework ? { framework } : {}), ...(traces ? { traces } : {}) }
}

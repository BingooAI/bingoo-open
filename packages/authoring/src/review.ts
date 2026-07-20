// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Áp quyết định duyệt của chuyên gia lên bản nháp — hàm THUẦN (change-set). */

import type { CompetencyKind, PrereqMode, RelType } from '@bingoo.ai/knowledge-engine'
import type { EdgeDraft, IngestDraft, LocalizedText } from './model'

export type ReviewDecision =
  | { readonly op: 'rename'; readonly tempId: string; readonly title: LocalizedText }
  | { readonly op: 'reclassify'; readonly tempId: string; readonly kind: CompetencyKind }
  | { readonly op: 'drop-concept'; readonly tempId: string }
  | {
      readonly op: 'add-edge'
      readonly fromTempId: string
      readonly toTempId: string
      readonly relType: RelType
      readonly mode: PrereqMode
      readonly weight?: number
    }
  | { readonly op: 'drop-edge'; readonly fromTempId: string; readonly toTempId: string }

/** Chuỗi quyết định → bản nháp mới. Không mutate đầu vào; tất định (dễ test & lần vết). */
export function applyReview(draft: IngestDraft, decisions: readonly ReviewDecision[]): IngestDraft {
  let concepts = [...draft.concepts]
  let edges = [...draft.edges]
  const dropped = new Set<string>()

  for (const d of decisions) {
    switch (d.op) {
      case 'rename':
        concepts = concepts.map((c) => (c.tempId === d.tempId ? { ...c, title: d.title } : c))
        break
      case 'reclassify':
        concepts = concepts.map((c) => (c.tempId === d.tempId ? { ...c, kind: d.kind } : c))
        break
      case 'drop-concept':
        dropped.add(d.tempId)
        concepts = concepts.filter((c) => c.tempId !== d.tempId)
        break
      case 'add-edge': {
        const edge: EdgeDraft = {
          fromTempId: d.fromTempId,
          toTempId: d.toTempId,
          relType: d.relType,
          mode: d.mode,
          ...(d.weight !== undefined ? { weight: d.weight } : {}),
        }
        edges = [...edges, edge]
        break
      }
      case 'drop-edge':
        edges = edges.filter((e) => !(e.fromTempId === d.fromTempId && e.toTempId === d.toTempId))
        break
    }
  }

  if (dropped.size > 0) {
    edges = edges.filter((e) => !dropped.has(e.fromTempId) && !dropped.has(e.toTempId))
  }
  return { ...draft, concepts, edges }
}

// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * DÙNG CHUNG KIẾN THỨC GIỮA HAI KHUNG — đường mà cả hệ được dựng lên để đi, và nó từng bị chặn.
 *
 * Ca thật: đưa khung thứ hai vào một kho đã có khung thứ nhất. Dedup nhận ra "so sánh và sắp thứ tự
 * số" của khung mới chính là kiến thức đã có, nên không dựng lại node cho nó — đúng, vì nó đã tồn
 * tại. Nhưng cạnh MAPS_TO của mục tiêu vì thế trỏ RA NGOÀI lô, và bước kiểm chỉ nhìn trong lô kết
 * luận "mục tiêu chưa ánh xạ tới đâu cả" rồi CHẶN việc ghi.
 *
 * Càng khớp được nhiều với vốn đã có thì càng bị chặn nhiều — nghĩa là hệ phạt đúng cái nó muốn.
 */

import { describe, expect, it } from 'vitest'
import { compileDraft, validateDraft, hasBlockingIssue } from '../src/index'
import type { IngestDraft, Slug } from '../src/index'

/** Kiến thức đã có trong kho, đến từ một khung khác. */
const EXISTING = [
  {
    slug: 'compare-and-order-numbers' as Slug,
    title: 'Compare and order numbers',
    kind: 'KNOWLEDGE' as const,
  },
]

/** Khung MỚI phát biểu cùng một kiến thức bằng chữ của nó. */
const draft = (conceptTitleEn: string): IngestDraft => ({
  concepts: [
    {
      tempId: 'c1',
      title: { en: conceptTitleEn, vi: conceptTitleEn },
      kind: 'KNOWLEDGE',
      evidence: [],
    },
  ],
  edges: [],
  framework: {
    slug: 'second-framework',
    name: { en: 'Second framework', vi: 'Khung thứ hai' },
    kind: 'CURRICULUM',
    locale: 'en',
    objectives: [
      {
        tempId: 'o1',
        title: { en: 'Compare and order numbers from 0 to 20', vi: 'So sánh, sắp thứ tự số 0 đến 20' },
        mapsToTempIds: ['c1'],
        evidence: [],
      },
    ],
  },
  warnings: [],
})

describe('mục tiêu đo bằng kiến thức ĐÃ CÓ trong kho', () => {
  const compiled = compileDraft(draft('Compare and order numbers'), EXISTING)

  it('dedup khớp vào kiến thức có sẵn, nên không dựng lại node cho nó', () => {
    expect(compiled.dedup.merges.some((m) => m.reason === 'existing')).toBe(true)
    expect(compiled.graph.nodes.filter((n) => n.kind !== 'OBJECTIVE')).toHaveLength(0)
    expect(compiled.objectives[0]?.mapsTo).toEqual(['compare-and-order-numbers'])
  })

  it('KHÔNG chặn — dùng chung khung là mục đích, không phải khuyết điểm', () => {
    const issues = validateDraft(compiled)
    expect(hasBlockingIssue(issues)).toBe(false)
    expect(issues.some((i) => i.code === 'OBJECTIVE_NO_MAPPING')).toBe(false)
    expect(issues.some((i) => i.code === 'MAPPING_TARGET_MISSING')).toBe(false)
  })

  it('vẫn NÓI RA, và nói ra là dùng chung với kiến thức nào', () => {
    const hit = validateDraft(compiled).find((i) => i.code === 'OBJECTIVE_MAPS_TO_EXISTING')
    expect(hit?.severity).toBe('info') // không phải warning: không có gì cần sửa
    expect(hit?.refs).toContain('compare-and-order-numbers')
  })
})

describe('lan can vẫn còn răng — không phải cái gì trỏ ra ngoài lô cũng cho qua', () => {
  it('trỏ tới một kiến thức KHÔNG có trong lô lẫn trong kho thì vẫn CHẶN', () => {
    // Nhan đề khác hẳn nên dedup không khớp vào kho; node được dựng trong lô…
    const compiled = compileDraft(draft('Measure length with rulers'), EXISTING)
    expect(compiled.graph.nodes.filter((n) => n.kind !== 'OBJECTIVE')).toHaveLength(1)

    // …rồi cố tình gỡ nó đi, đúng như khi người duyệt loại một mục không phải kiến thức dạy được.
    const broken = {
      ...compiled,
      graph: {
        nodes: compiled.graph.nodes.filter((n) => n.kind === 'OBJECTIVE'),
        edges: compiled.graph.edges,
      },
    }
    const issues = validateDraft(broken)
    expect(hasBlockingIssue(issues)).toBe(true)
    expect(issues.some((i) => i.code === 'OBJECTIVE_MAPS_TO_EXISTING')).toBe(false)
  })

  it('mục tiêu không khai ánh xạ nào thì vẫn CHẶN', () => {
    const d = draft('Compare and order numbers')
    const noMap: IngestDraft = {
      ...d,
      framework: {
        ...d.framework!,
        objectives: [{ ...d.framework!.objectives[0]!, mapsToTempIds: [] }],
      },
    }
    const issues = validateDraft(compileDraft(noMap, EXISTING))
    expect(issues.some((i) => i.code === 'OBJECTIVE_NO_MAPPING' && i.severity === 'error')).toBe(true)
  })
})

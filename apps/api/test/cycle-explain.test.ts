// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * MẮT NÀO CỦA VÒNG LÀ CHẮC — câu hỏi duy nhất mà cổng gỡ vòng tồn tại để trả lời.
 *
 * Người duyệt được bảo "gỡ mắt yếu nhất, mắt máy tự chứng được thì đừng gỡ". Lời khuyên đó chỉ có
 * nghĩa nếu giao diện phân biệt được hai loại. Nó từng KHÔNG phân biệt: chỗ dựng mô tả vòng quên
 * truyền `inputsVerified`, nên cap trung thực hạ mọi mắt xuống "phán đoán" — kể cả mắt mà cấu trúc
 * tự chứng — và nhãn xanh thành mã chết không đường nào chạm tới.
 *
 * Hỏng kiểu này không lộ ra: giao diện vẫn hiện đủ, chữ vẫn đúng ngữ pháp, chỉ là nó nói sai về
 * chính thứ nó được dựng để nói.
 */

import { describe, expect, it } from 'vitest'
import type { GraphData, SkillNode, Slug } from '@bingoo.ai/knowledge-engine'
import type { CompiledConcept } from '@bingoo.ai/authoring'
import { describeCycles, verifiedSlugs } from '../src/services/authoring-framework.service'

const kc = (slug: string, facets: SkillNode['facets']): SkillNode => ({
  slug: slug as Slug,
  title: { en: slug, vi: slug },
  kind: 'KNOWLEDGE',
  subject: 'math',
  facets,
})

/**
 * Vòng hai mắt, KHÔNG cân xứng — và đó là điểm mấu chốt.
 *
 * Đếm trong 20 nằm gọn trong đếm trong 100, nên chiều hẹp-trước-rộng là thứ CẤU TRÚC tự chứng
 * được; chiều ngược lại thì cấu trúc nói ngược. Một vòng mà cả hai mắt đều mờ như nhau thì không
 * kiểm được gì.
 */
const graph: GraphData = {
  nodes: [
    kc('count-20', { object: 'counting', channel: 'compute', scope: { max: 20 } }),
    kc('count-100', { object: 'counting', channel: 'compute', scope: { max: 100 } }),
  ],
  edges: [
    {
      from: 'count-20' as Slug,
      to: 'count-100' as Slug,
      relType: 'PREREQUISITE',
      mode: 'REQUIRED',
      weight: 1,
    },
    {
      from: 'count-100' as Slug,
      to: 'count-20' as Slug,
      relType: 'PREREQUISITE',
      mode: 'REQUIRED',
      weight: 1,
    },
  ],
}

const VIOLATION = [{ code: 'I6_ORDERING_CYCLE', slugs: ['count-20', 'count-100', 'count-20'] }]

const concepts = (verified: boolean): CompiledConcept[] =>
  ['count-20', 'count-100'].map((s) => ({
    slug: s as Slug,
    title: { en: s },
    kind: 'KNOWLEDGE' as const,
    evidence: [{ chunkId: 'c0', quote: 'x', verified }],
  }))

const links = (verified: boolean) =>
  describeCycles(graph, VIOLATION, verifiedSlugs(concepts(verified)))[0]?.links ?? []

describe('vòng học: mắt nào chắc, mắt nào chỉ là phán đoán', () => {
  it('mắt cấu trúc tự chứng được VÀ hai đầu có câu trích đã kiểm → CHẮC', () => {
    const forward = links(true).find((l) => l.from === 'count-20')
    expect(forward?.explanation.tier).toBe('proven')
    expect(forward?.explanation.machineProven).toBe(true) // nhãn xanh chạm tới được
  })

  it('mắt ngược chiều bao hàm → NÓI NGƯỢC, và đó chính là mắt nên gỡ', () => {
    const back = links(true).find((l) => l.from === 'count-100')
    expect(back?.explanation.tier).toBe('contradicted')
    expect(back?.explanation.machineProven).toBe(false)
  })

  it('cùng cấu trúc đó nhưng câu trích CHƯA kiểm → không mắt nào được gọi là chắc', () => {
    // Suy luận đúng trên dấu hiệu do AI đoán vẫn là kết luận đoán. Cap trung thực phải hạ bậc,
    // nếu không thì "chắc" chỉ còn nghĩa là "máy tính ra được", tức là không còn nghĩa gì.
    expect(links(false).every((l) => l.explanation.machineProven === false)).toBe(true)
    expect(links(false).find((l) => l.from === 'count-20')?.explanation.provenanceCaveat).toBe(true)
  })

  it('không truyền bằng chứng vào thì mặc định là CHƯA kiểm, không phải đã kiểm', () => {
    // Đường bản nháp quay lại từ trình duyệt không mang bằng chứng. Mặc định phải nghiêng về phía
    // dè dặt — đoán rằng đã kiểm là tô xanh cho thứ chưa ai đối chiếu.
    const noEvidence = describeCycles(graph, VIOLATION)[0]?.links ?? []
    expect(noEvidence.every((l) => l.explanation.machineProven === false)).toBe(true)
  })
})

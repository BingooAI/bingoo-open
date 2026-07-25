// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Một engine giải thích cho mọi mặt — và các CAP trung thực phải không lách được.
 *
 * Nhóm test cuối là loại phá-để-kiểm: mỗi cái mô tả một cách overclaim cụ thể, và nó đỏ nếu ai gỡ
 * cap tương ứng. Test chỉ xanh trên input tốt thì không chứng minh được lan can nào cả.
 */
import { describe, expect, it } from 'vitest'
import type { Facets } from '@bingoo.ai/facets'
import { compareFacetAxes, explainClaim } from '../src/claim-explain'

const count = (max: number): Facets => ({ object: 'counting', channel: 'compute', scope: { max } })

describe('làn cấu trúc — phạm vi bao nhau tự chứng thứ tự', () => {
  it('đếm đến 10 trước đếm đến 20: cùng đối tượng, phạm vi nằm gọn', () => {
    const r = explainClaim({
      claimKind: 'ORDERING_EDGE',
      relType: 'PREREQUISITE',
      fromFacets: count(10),
      toFacets: count(20),
      inputsVerified: true,
    })
    expect(r.tier).toBe('proven')
    expect(r.basis).toBe('STRUCTURAL')
    expect(r.machineProven).toBe(true)
    expect(r.relation?.basis).toBe('ordering-proven')
  })

  it('chiều ngược thành CÂU HỎI, và nói rõ nghi vấn đến từ cấu trúc', () => {
    const r = explainClaim({
      claimKind: 'ORDERING_EDGE',
      relType: 'PREREQUISITE',
      fromFacets: count(100),
      toFacets: count(20),
      inputsVerified: true,
    })
    expect(r.tier).toBe('contradicted')
    expect(r.contradictedBy).toBe('structure')
    expect(r.machineProven).toBe(false)
  })

  it('khác đối tượng → phán đoán, không phải "chứng được"', () => {
    const r = explainClaim({
      claimKind: 'ORDERING_EDGE',
      relType: 'PREREQUISITE',
      fromFacets: { object: 'counting', channel: 'compute', scope: { max: 100 } },
      toFacets: { object: 'place-value', channel: 'understand', scope: { max: 100 } },
      inputsVerified: true,
    })
    expect(r.tier).toBe('ai-judgment')
    expect(r.machineProven).toBe(false)
  })
})

describe('làn nguồn — câu trích phải nằm nguyên văn trong tài liệu', () => {
  const source = 'Nhận biết được chục và đơn vị, số tròn chục.'

  it('khớp nguyên văn → bậc câu-trích, tô "từ tài liệu"', () => {
    const r = explainClaim({
      claimKind: 'OBJECTIVE_EXISTS',
      quote: 'Nhận biết được chục và đơn vị',
      sourceExcerpt: source,
    })
    expect(r.tier).toBe('quote-verified')
    expect(r.basis).toBe('FROM_SOURCE')
    expect(r.quote?.status).toBe('verified')
  })

  it('câu AI bịa → phán đoán, không bao giờ "từ tài liệu"', () => {
    const r = explainClaim({
      claimKind: 'OBJECTIVE_EXISTS',
      quote: 'Học sinh cần yêu thích môn Toán ngay từ lớp một',
      sourceExcerpt: source,
    })
    expect(r.tier).toBe('ai-judgment')
    expect(r.basis).toBe('AI_INFERRED')
    expect(r.quote?.status).toBe('not_found')
  })

  it('không neo toạ độ cho câu chưa khớp — mũi tên trỏ vào chỗ trống là tệ hơn không có', () => {
    const units = [{ text: source, page: 187, order: 0 }]
    const bịa = explainClaim({
      claimKind: 'OBJECTIVE_EXISTS',
      quote: 'Một câu không hề có trong tài liệu này',
      sourceExcerpt: source,
      units,
    })
    expect(bịa.anchor).toBeUndefined()

    const thật = explainClaim({
      claimKind: 'OBJECTIVE_EXISTS',
      quote: 'Nhận biết được chục và đơn vị',
      sourceExcerpt: source,
      units,
    })
    expect(thật.anchor?.matchQuality).toBe('exact')
  })
})

describe('so từng trục — trả lời "vì sao trùng / vì sao khác", và giải thích lúc máy bí', () => {
  it('nêu đúng trục nào giống, trục nào khác', () => {
    const a = compareFacetAxes(count(20), count(100))
    expect(a.axes.find((x) => x.axis === 'object')?.same).toBe(true)
    expect(a.axes.find((x) => x.axis === 'scope')?.same).toBe(false)
    expect(a.scope).toBe('subset')
    expect(a.indistinguishable).toBe(false)
  })

  it('trùng khít mọi trục → máy KHÔNG phân biệt được (đây là I1, và là việc của người duyệt)', () => {
    // Đúng ca thật đã chặn khung: một câu "Nhận biết được chục và đơn vị, số tròn chục" bị AI tách
    // thành hai khái niệm nhưng gán y hệt facet — máy không có cơ sở nào để tách.
    const f: Facets = { object: 'place-value', channel: 'recognize', bloom: 'understand' }
    const a = compareFacetAxes(f, { ...f })
    expect(a.indistinguishable).toBe(true)
    expect(a.sameCount).toBe(a.comparedCount)
  })

  it('trục chỉ một bên khai KHÔNG tính là khác — thiếu tin khác với lệch', () => {
    const a = compareFacetAxes({ object: 'counting' }, { object: 'counting', bloom: 'apply' })
    expect(a.axes.find((x) => x.axis === 'bloom')?.same).toBe(false)
    expect(a.comparedCount).toBe(1) // chỉ `object` được đem so
    expect(a.indistinguishable).toBe(true) // mọi trục SO ĐƯỢC đều trùng
  })
})

describe('CAP TRUNG THỰC — mỗi test dưới đây đỏ nếu ai gỡ một cap', () => {
  it('điểm giống MỜ không nâng bậc, dù cao đến đâu', () => {
    // Cap này quan trọng vì con số dễ thuyết phục hơn nó đáng: 0.97 trông như bằng chứng.
    const r = explainClaim({
      claimKind: 'CONCEPT_IDENTITY',
      fuzzy: { trigram: 0.97, cosine: 0.99 },
    })
    expect(r.tier).toBe('ai-judgment')
    expect(r.machineProven).toBe(false)
    expect(r.fuzzy?.trigram).toBe(0.97) // vẫn HIỆN — chỉ là không quyết định
  })

  it('thứ tự đọc tài liệu không bao giờ vượt bậc "tài liệu xếp theo chiều này"', () => {
    const r = explainClaim({
      claimKind: 'ORDERING_EDGE',
      relType: 'PREREQUISITE',
      readingOrder: { fromOrder: 1, toOrder: 5 },
      inputsVerified: true,
    })
    expect(r.tier).toBe('reading-order-corroborated')
    expect(r.basis).toBe('AI_INFERRED') // thứ tự trang KHÔNG phải bằng chứng sư phạm
    expect(r.machineProven).toBe(false)
  })

  it('tài liệu xếp ngược → CÂU HỎI, và nói rõ nghi vấn đến từ thứ tự đọc', () => {
    const r = explainClaim({
      claimKind: 'ORDERING_EDGE',
      relType: 'PREREQUISITE',
      readingOrder: { fromOrder: 9, toOrder: 2 },
    })
    expect(r.tier).toBe('contradicted')
    expect(r.contradictedBy).toBe('reading-order') // khác hẳn 'structure' → UI đặt câu khác
  })

  it('suy luận đúng trên phạm vi CHƯA KIỂM vẫn không được gọi là "chắc"', () => {
    // Bước cấu trúc hợp lệ, nhưng phạm vi {max:10}/{max:20} do AI gán và chưa ai đối chiếu tài liệu.
    const r = explainClaim({
      claimKind: 'ORDERING_EDGE',
      relType: 'PREREQUISITE',
      fromFacets: count(10),
      toFacets: count(20),
      // inputsVerified bỏ trống — mặc định là CHƯA kiểm
    })
    expect(r.tier).toBe('proven') // logic vẫn đúng
    expect(r.machineProven).toBe(false) // nhưng không được tô "chắc chắn"
    expect(r.basis).toBe('AI_INFERRED')
    expect(r.provenanceCaveat).toBe(true) // câu chữ phải nêu điều kiện
  })

  it('không có làn nào kiểm được thì không có gì được lên "chứng được"', () => {
    const r = explainClaim({ claimKind: 'CONCEPT_EXISTS' })
    expect(r.tier).toBe('ai-judgment')
    expect(r.machineProven).toBe(false)
  })

  it('engine chỉ BÁO, không sửa: nói ngược không làm mất cạnh hay đổi quan hệ', () => {
    const input = {
      claimKind: 'ORDERING_EDGE' as const,
      relType: 'PREREQUISITE',
      fromFacets: count(100),
      toFacets: count(20),
    }
    const r = explainClaim(input)
    expect(r.tier).toBe('contradicted')
    // Quan hệ giữ NGUYÊN như đầu vào — tự đảo cạnh vì một tín hiệu là cách làm hỏng dữ liệu thật.
    expect(r.relation?.relType).toBe('PREREQUISITE')
    expect(input.fromFacets).toEqual(count(100))
  })
})

describe('mọi mặt dùng CHUNG một engine', () => {
  it('bài sách → kiến thức: cùng làn nguồn, chỉ khác loại khẳng định', () => {
    const r = explainClaim({
      claimKind: 'LESSON_MAPPING',
      relType: 'MAPS_TO',
      quote: 'Phép cộng trong phạm vi 10',
      sourceExcerpt: 'Bài 12. Phép cộng trong phạm vi 10 — luyện tập',
    })
    expect(r.tier).toBe('quote-verified')
    expect(r.relation?.basis).toBe('mapping')
  })

  it('kiến thức MỚI phát hiện từ sách: neo vào sách, nhưng vẫn là đề xuất chờ người duyệt', () => {
    const r = explainClaim({
      claimKind: 'KC_PROPOSED',
      quote: 'Phép cộng trong phạm vi 10',
      sourceExcerpt: 'Bài 12. Phép cộng trong phạm vi 10 — luyện tập',
    })
    // Có câu trích thật trong sách, nhưng "sách có nói" không đồng nghĩa "khung nên có" —
    // đó là quyết định của người duyệt, nên bậc không bao giờ là `proven`.
    expect(r.tier).toBe('quote-verified')
    expect(r.machineProven).toBe(false)
  })
})

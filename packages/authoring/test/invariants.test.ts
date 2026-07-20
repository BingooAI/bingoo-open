/**
 * BẤT BIẾN I1–I8 — cổng chặn ghi. Đây là thứ biến "quy ước trong đầu" thành "code chạy được".
 * Mọi bug đã gặp đều là một bất biến bị vi phạm mà KHÔNG AI BÁO.
 */

import { describe, expect, it } from 'vitest'
import type { DomainProfile } from '@bingoo/facets'
import type { GraphData, SkillNode } from '@bingoo/knowledge-engine'
import { checkInvariants, hasBlockingViolation } from '../src/index'

const math: DomainProfile = { domain: 'math', requiredAxes: ['object'] }
const profiles = { math }

const kc = (slug: string, extra: Partial<SkillNode> = {}): SkillNode => ({
  slug,
  title: { en: slug },
  kind: 'KNOWLEDGE',
  subject: 'math',
  facets: { object: slug },
  ...extra,
})

const objective = (slug: string, extra: Partial<SkillNode> = {}): SkillNode => ({
  slug,
  title: { en: slug },
  kind: 'OBJECTIVE',
  ...extra,
})

const graph = (nodes: SkillNode[], edges: GraphData['edges'] = []): GraphData => ({ nodes, edges })

const codes = (g: GraphData): string[] => checkInvariants(g, { profiles }).map((v) => v.code)

describe('I7 — TIẾNG ANH LÀ GỐC', () => {
  it('thiếu title.en → CHẶN (slug/định danh mint từ tiếng Anh; không có nó thì mọi khung sau lệch nhau)', () => {
    const g = graph([{ ...kc('a'), title: { vi: 'Phép cộng' } }])
    expect(codes(g)).toContain('I7_MISSING_CANONICAL_EN')
    expect(hasBlockingViolation(checkInvariants(g, { profiles }))).toBe(true)
  })
})

describe('I2 — nhãn riêng của khung không được nằm trên KC', () => {
  // Lỗi tôi tự gây rồi tự bắt: cùng một KC "cộng trong 20" nằm ở Cambridge Stage 2 VÀ Lớp 1 Việt Nam.
  // KC không thể có MỘT stage. stage thuộc về OBJECTIVE.
  it('KC mang stage → CHẶN', () => {
    expect(codes(graph([kc('add', { stage: 'Stage 1' })]))).toContain('I2_FRAMEWORK_LABEL_ON_KC')
  })
  it('OBJECTIVE mang stage → hợp lệ', () => {
    const g = graph(
      [objective('1nc-01', { stage: 'Stage 1' }), kc('counting')],
      [{ from: '1nc-01', to: 'counting', relType: 'MAPS_TO', mode: 'REQUIRED', weight: 1 }],
    )
    expect(codes(g)).not.toContain('I2_FRAMEWORK_LABEL_ON_KC')
  })
})

describe('I8 — trục facet bắt buộc của môn (hồ sơ môn là DỮ LIỆU, không phải code)', () => {
  it('KC thiếu trục bắt buộc → CHẶN', () => {
    expect(codes(graph([{ ...kc('a'), facets: {} }]))).toContain('I8_MISSING_REQUIRED_FACET')
  })
  it('không có hồ sơ môn thì I8 im lặng (thêm môn = thêm MỘT DÒNG DB, không sửa code)', () => {
    const g = graph([{ ...kc('a'), subject: 'music', facets: {} }])
    expect(codes(g)).not.toContain('I8_MISSING_REQUIRED_FACET')
  })
})

describe('I1 — không phân biệt được hai KC → CỔNG NGƯỜI DUYỆT (máy KHÔNG tự gộp)', () => {
  it('hai KC trùng khít facets → CHẶN để người chốt', () => {
    const g = graph([kc('a'), { ...kc('b'), facets: { object: 'a' } }])
    expect(codes(g)).toContain('I1_IDENTITY_COLLISION')
  })
  it('bắt trùng cả với KC ĐÃ CÓ trong đồ thị, không chỉ trong lô đang ghi', () => {
    const v = checkInvariants(graph([kc('new-one', { facets: { object: 'addition' } })]), {
      profiles,
      existing: [kc('old-one', { facets: { object: 'addition' } })],
    })
    expect(v.map((x) => x.code)).toContain('I1_IDENTITY_COLLISION')
  })
  it('khác object → không va chạm', () => {
    expect(codes(graph([kc('parity'), kc('addition')]))).not.toContain('I1_IDENTITY_COLLISION')
  })
})

describe('I4/I5 — OBJECTIVE phải neo được vào bằng chứng', () => {
  it('objective không MAPS_TO KC nào → CHẶN (không thể chứng nhận bằng bất cứ gì)', () => {
    expect(codes(graph([objective('o1')]))).toContain('I5_ORPHAN_OBJECTIVE')
  })

  // Lỗi thật: persistFramework ghi MAPS_TO là RECOMMENDED → chứng nhận bằng TRUNG BÌNH CÓ TRỌNG SỐ,
  // tức có thể "đạt" objective trong khi còn thiếu hẳn một mắt xích. Đạt = AND, không phải trung bình.
  it('MAPS_TO không REQUIRED → cảnh báo (chứng nhận sẽ thành trung bình, "đạt" hụt)', () => {
    const g = graph(
      [objective('o1'), kc('counting')],
      [{ from: 'o1', to: 'counting', relType: 'MAPS_TO', mode: 'RECOMMENDED', weight: 1 }],
    )
    expect(codes(g)).toContain('I4_MAPS_TO_NOT_REQUIRED')
  })
})

describe('I3 — OBJECTIVE không phải nơi fold bằng chứng', () => {
  it('objective mang facets → cảnh báo', () => {
    const g = graph(
      [objective('o1', { facets: { object: 'counting' } }), kc('counting')],
      [{ from: 'o1', to: 'counting', relType: 'MAPS_TO', mode: 'REQUIRED', weight: 1 }],
    )
    expect(codes(g)).toContain('I3_OBJECTIVE_NOT_MEASURABLE')
  })
})

describe('I6 — thứ tự phải là DAG', () => {
  it('chu trình tiên quyết → CHẶN', () => {
    const g = graph(
      [kc('a'), kc('b')],
      [
        { from: 'a', to: 'b', relType: 'PREREQUISITE', mode: 'REQUIRED', weight: 1 },
        { from: 'b', to: 'a', relType: 'PREREQUISITE', mode: 'REQUIRED', weight: 1 },
      ],
    )
    expect(codes(g)).toContain('I6_ORDERING_CYCLE')
  })
})

describe('đồ thị sạch', () => {
  it('không vi phạm gì → không có gì chặn', () => {
    const g = graph(
      [objective('1nc-01', { stage: 'Stage 1' }), kc('counting'), kc('addition')],
      [
        { from: '1nc-01', to: 'counting', relType: 'MAPS_TO', mode: 'REQUIRED', weight: 1 },
        { from: 'counting', to: 'addition', relType: 'PREREQUISITE', mode: 'REQUIRED', weight: 1 },
      ],
    )
    expect(checkInvariants(g, { profiles })).toEqual([])
  })
})

// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Cổng cho người duyệt khi máy bí — và nó phải KHÔNG tự quyết bất cứ điều gì.
 *
 * Ca thật dựng lại ở đây là ca vừa chặn một khung sinh từ chương trình thật: một câu "Nhận biết được
 * chục và đơn vị, số tròn chục" bị tách thành hai kiến thức với facet trùng khít.
 */
import { describe, expect, it } from 'vitest'
import type { GraphData, SkillNode, Slug } from '@bingoo.ai/knowledge-engine'
import { checkInvariants } from '../src/invariants'
import { applyCollisionDecisions, type CollisionDecision } from '../src/resolve-collision'
import type { CompiledObjective } from '../src/compile'

const kc = (slug: string, en: string, facets: SkillNode['facets']): SkillNode => ({
  slug: slug as Slug,
  title: { en, vi: en },
  kind: 'KNOWLEDGE',
  subject: 'math',
  facets,
})

/** Hai kiến thức tách từ MỘT câu, facet trùng khít — máy không có cơ sở tách. */
const SAME_FACETS = { object: 'place-value', channel: 'recognize', bloom: 'understand' } as const
const tensUnits = kc('recognize-tens-and-units', 'Recognise tens and units', { ...SAME_FACETS })
const roundTens = kc('recognize-round-tens', 'Recognise round tens', { ...SAME_FACETS })

const graph = (): GraphData => ({
  nodes: [
    kc('count-100', 'Count within 100', { object: 'counting', channel: 'compute', scope: { max: 100 } }),
    tensUnits,
    roundTens,
    kc('addsub-100', 'Add and subtract within 100', {
      object: 'addition+subtraction',
      channel: 'compute',
      scope: { max: 100 },
    }),
  ],
  edges: [
    {
      from: 'count-100' as Slug,
      to: 'recognize-tens-and-units' as Slug,
      relType: 'PREREQUISITE',
      mode: 'REQUIRED',
      weight: 1,
    },
    {
      from: 'count-100' as Slug,
      to: 'recognize-round-tens' as Slug,
      relType: 'PREREQUISITE',
      mode: 'REQUIRED',
      weight: 1,
    },
    {
      from: 'recognize-tens-and-units' as Slug,
      to: 'addsub-100' as Slug,
      relType: 'PREREQUISITE',
      mode: 'REQUIRED',
      weight: 1,
    },
    {
      from: 'recognize-round-tens' as Slug,
      to: 'addsub-100' as Slug,
      relType: 'PREREQUISITE',
      mode: 'REQUIRED',
      weight: 1,
    },
  ],
})

const objectives = (): CompiledObjective[] => [
  {
    slug: 'obj-tens' as Slug,
    title: { en: 'Recognise tens, units and round tens', vi: 'Nhận biết chục, đơn vị và số tròn chục' },
    code: 'G1.N.02',
    mapsTo: ['recognize-tens-and-units' as Slug, 'recognize-round-tens' as Slug],
  },
]

const collisions = (g: GraphData) => checkInvariants(g, {}).filter((v) => v.code === 'I1_IDENTITY_COLLISION')

describe('bối cảnh: máy thật sự bí, và nó nói ra là bí', () => {
  it('facet trùng khít → I1 chặn, kèm đúng hai slug để người duyệt xử', () => {
    const v = collisions(graph())
    expect(v).toHaveLength(1)
    expect(v[0]?.severity).toBe('error')
    expect([...(v[0]?.slugs ?? [])].sort()).toEqual(['recognize-round-tens', 'recognize-tens-and-units'])
  })
})

describe('lối GỘP — đúng là một kiến thức', () => {
  it('cạnh và ánh xạ của cái bị gộp chuyển hết về cái giữ lại, và I1 hết đỏ', () => {
    const r = applyCollisionDecisions({ graph: graph(), objectives: objectives() }, [
      { kind: 'merge', keep: 'recognize-tens-and-units' as Slug, drop: 'recognize-round-tens' as Slug },
    ])
    expect(r.graph.nodes.map((n) => n.slug)).not.toContain('recognize-round-tens')
    expect(collisions(r.graph)).toHaveLength(0)

    // Hai cạnh song song thành một sau khi chuyển — không để lại cạnh trùng.
    const toAddsub = r.graph.edges.filter((e) => e.to === 'addsub-100')
    expect(toAddsub).toHaveLength(1)
    expect(toAddsub[0]?.from).toBe('recognize-tens-and-units')

    // Mục tiêu phải trỏ sang cái giữ lại, không thì nó mất chỗ neo và I5 coi là mồ côi.
    expect(r.objectives[0]?.mapsTo).toEqual(['recognize-tens-and-units'])
    expect(r.applied[0]?.effect.objectivesRewired).toBe(1)
    // Cả HAI cặp cạnh đều song song sau khi chuyển (count→… và …→addsub), nên bỏ 2, còn lại 2.
    expect(r.applied[0]?.effect.edgesDropped).toBe(2)
    expect(r.graph.edges).toHaveLength(2)
  })

  it('không để lại cạnh tự-trỏ khi hai đầu của một cạnh bị gộp làm một', () => {
    const g: GraphData = {
      nodes: [tensUnits, roundTens],
      edges: [
        {
          from: 'recognize-tens-and-units' as Slug,
          to: 'recognize-round-tens' as Slug,
          relType: 'PREREQUISITE',
          mode: 'REQUIRED',
          weight: 1,
        },
      ],
    }
    const r = applyCollisionDecisions({ graph: g, objectives: [] }, [
      { kind: 'merge', keep: 'recognize-tens-and-units' as Slug, drop: 'recognize-round-tens' as Slug },
    ])
    expect(r.graph.edges).toHaveLength(0)
    expect(r.applied[0]?.effect.edgesDropped).toBe(1)
  })
})

describe('lối PHÂN BIỆT — là hai kiến thức, và người duyệt nói ra điều gì khác', () => {
  it('bổ sung trục phân biệt → giữ cả hai KC, I1 hết đỏ', () => {
    const r = applyCollisionDecisions({ graph: graph(), objectives: objectives() }, [
      { kind: 'distinguish', slug: 'recognize-round-tens' as Slug, axis: 'object', value: 'round-tens' },
    ])
    expect(r.graph.nodes).toHaveLength(4) // không mất kiến thức nào
    expect(collisions(r.graph)).toHaveLength(0)
    expect(r.applied[0]?.effect.facetChanged).toEqual({
      axis: 'object',
      from: 'place-value',
      to: 'round-tens',
    })
    // Mục tiêu vẫn đo bằng cả hai — hai kiến thức thì mục tiêu cần cả hai.
    expect(r.objectives[0]?.mapsTo).toHaveLength(2)
  })

  it('giá trị mới VẪN trùng thì I1 đỏ tiếp — cổng không giả vờ kiểm hộ', () => {
    const r = applyCollisionDecisions({ graph: graph(), objectives: objectives() }, [
      { kind: 'distinguish', slug: 'recognize-round-tens' as Slug, axis: 'object', value: 'place-value' },
    ])
    expect(r.applied).toHaveLength(1) // vẫn thi hành đúng điều được yêu cầu
    expect(collisions(r.graph)).toHaveLength(1) // nhưng lan can vẫn đứng
  })
})

describe('không tự quyết, không âm thầm bỏ qua', () => {
  it('không quyết định nào → không đổi gì (máy KHÔNG tự chọn lối)', () => {
    const g = graph()
    const r = applyCollisionDecisions({ graph: g, objectives: objectives() }, [])
    expect(r.graph.nodes).toHaveLength(4)
    expect(r.applied).toHaveLength(0)
    expect(collisions(r.graph)).toHaveLength(1) // vẫn chặn — đúng, vì chưa ai chốt
  })

  it('slug không có thật → BÁO, không im lặng no-op', () => {
    const r = applyCollisionDecisions({ graph: graph(), objectives: objectives() }, [
      { kind: 'merge', keep: 'recognize-tens-and-units' as Slug, drop: 'khong-ton-tai' as Slug },
    ])
    expect(r.applied).toHaveLength(0)
    expect(r.rejected[0]?.code).toBe('unknown-slug')
  })

  it('từ chối gộp MỤC TIÊU — trộn hai khung là việc của crosswalk, không phải cổng này', () => {
    const g: GraphData = {
      nodes: [
        { slug: 'obj-a' as Slug, title: { en: 'A', vi: 'A' }, kind: 'OBJECTIVE' },
        { slug: 'obj-b' as Slug, title: { en: 'B', vi: 'B' }, kind: 'OBJECTIVE' },
      ],
      edges: [],
    }
    const r = applyCollisionDecisions({ graph: g, objectives: [] }, [
      { kind: 'merge', keep: 'obj-a' as Slug, drop: 'obj-b' as Slug },
    ])
    expect(r.rejected[0]?.code).toBe('not-a-concept')
    expect(r.graph.nodes).toHaveLength(2)
  })

  it('gộp một cái vào chính nó → báo, không đổi gì', () => {
    const r = applyCollisionDecisions({ graph: graph(), objectives: objectives() }, [
      { kind: 'merge', keep: 'recognize-round-tens' as Slug, drop: 'recognize-round-tens' as Slug },
    ])
    expect(r.rejected[0]?.code).toBe('same-slug')
    expect(r.graph.nodes).toHaveLength(4)
  })

  it('trục phân biệt để trống → báo, không ghi facet rỗng vào đồ thị', () => {
    const r = applyCollisionDecisions({ graph: graph(), objectives: objectives() }, [
      { kind: 'distinguish', slug: 'recognize-round-tens' as Slug, axis: 'object', value: '   ' },
    ])
    expect(r.rejected[0]?.code).toBe('empty-value')
  })

  it('không sửa bản nháp gốc — người duyệt phải bỏ được quyết định của mình', () => {
    const g = graph()
    const o = objectives()
    applyCollisionDecisions({ graph: g, objectives: o }, [
      { kind: 'merge', keep: 'recognize-tens-and-units' as Slug, drop: 'recognize-round-tens' as Slug },
    ])
    expect(g.nodes).toHaveLength(4)
    expect(g.edges).toHaveLength(4)
    expect(o[0]?.mapsTo).toHaveLength(2)
  })
})

describe('nhiều quyết định áp lần lượt theo đúng thứ tự người duyệt đọc', () => {
  it('gộp rồi phân biệt cái còn lại cũng ra kết quả nhất quán', () => {
    const decisions: CollisionDecision[] = [
      { kind: 'merge', keep: 'recognize-tens-and-units' as Slug, drop: 'recognize-round-tens' as Slug },
      {
        kind: 'distinguish',
        slug: 'recognize-tens-and-units' as Slug,
        axis: 'representation',
        value: 'abstract',
      },
    ]
    const r = applyCollisionDecisions({ graph: graph(), objectives: objectives() }, decisions)
    expect(r.applied).toHaveLength(2)
    expect(r.graph.nodes.find((n) => n.slug === 'recognize-tens-and-units')?.facets?.representation).toBe(
      'abstract',
    )
  })
})

describe('lối BỎ CẠNH — chuỗi học quay vòng', () => {
  /** Vòng thật gặp khi trích một khung tiểu học: tách-gộp-số ↔ cộng-trừ, mỗi cái đòi cái kia trước. */
  const cyclic = (): GraphData => ({
    nodes: [
      kc('decompose-10-20', 'Decompose numbers 10-20', { object: 'place-value', channel: 'compute' }),
      kc('add-subtract-20', 'Add and subtract within 20', { object: 'addition', channel: 'compute' }),
    ],
    edges: [
      {
        from: 'decompose-10-20' as Slug,
        to: 'add-subtract-20' as Slug,
        relType: 'PREREQUISITE',
        mode: 'REQUIRED',
        weight: 1,
      },
      {
        from: 'add-subtract-20' as Slug,
        to: 'decompose-10-20' as Slug,
        relType: 'PREREQUISITE',
        mode: 'REQUIRED',
        weight: 1,
      },
    ],
  })
  const cycles = (g: GraphData) => checkInvariants(g, {}).filter((v) => v.code === 'I6_ORDERING_CYCLE')

  it('máy thấy vòng nhưng KHÔNG tự gỡ — nó không biết mắt nào sai', () => {
    expect(cycles(cyclic())).toHaveLength(1)
    const r = applyCollisionDecisions({ graph: cyclic(), objectives: [] }, [])
    expect(cycles(r.graph)).toHaveLength(1) // không quyết định → vẫn chặn
  })

  it('người duyệt chỉ mắt sai → vòng hết, mắt còn lại giữ nguyên', () => {
    const r = applyCollisionDecisions({ graph: cyclic(), objectives: [] }, [
      { kind: 'drop-edge', from: 'add-subtract-20' as Slug, to: 'decompose-10-20' as Slug },
    ])
    expect(cycles(r.graph)).toHaveLength(0)
    expect(r.graph.edges).toHaveLength(1)
    expect(r.graph.edges[0]?.from).toBe('decompose-10-20')
    expect(r.applied[0]?.effect.edgesDropped).toBe(1)
  })

  it('cạnh không có thật → BÁO, không im lặng', () => {
    const r = applyCollisionDecisions({ graph: cyclic(), objectives: [] }, [
      { kind: 'drop-edge', from: 'decompose-10-20' as Slug, to: 'khong-co' as Slug },
    ])
    expect(r.rejected[0]?.code).toBe('unknown-edge')
  })
})

describe('lối BỎ MỤC — thứ trích ra không phải kiến thức dạy được', () => {
  /** Đặc điểm tư duy chung ("specialising", "conjecturing") lọt vào thành kiến thức khi trích khung. */
  const withNoise = (): GraphData => ({
    nodes: [
      kc('count-100', 'Count within 100', { object: 'counting', channel: 'compute', scope: { max: 100 } }),
      kc('specialising', 'Specialising', { object: 'thinking', channel: 'apply' }),
    ],
    edges: [
      {
        from: 'specialising' as Slug,
        to: 'count-100' as Slug,
        relType: 'PREREQUISITE',
        mode: 'REQUIRED',
        weight: 1,
      },
    ],
  })

  it('bỏ mục + mọi quan hệ của nó, và GIỮ LẠI lý do', () => {
    const r = applyCollisionDecisions({ graph: withNoise(), objectives: [] }, [
      {
        kind: 'drop-concept',
        slug: 'specialising' as Slug,
        reason: 'Đặc điểm tư duy chung, không phải kiến thức dạy được',
      },
    ])
    expect(r.graph.nodes.map((n) => n.slug)).toEqual(['count-100'])
    expect(r.graph.edges).toHaveLength(0)
    expect(r.applied[0]?.effect.reason).toContain('tư duy chung')
  })

  it('mục tiêu đang đo bằng mục bị bỏ thì gỡ tham chiếu — không để mục tiêu mồ côi', () => {
    const objs: CompiledObjective[] = [
      {
        slug: 'obj-a' as Slug,
        title: { en: 'A', vi: 'A' },
        mapsTo: ['specialising' as Slug, 'count-100' as Slug],
      },
    ]
    const r = applyCollisionDecisions({ graph: withNoise(), objectives: objs }, [
      { kind: 'drop-concept', slug: 'specialising' as Slug, reason: 'không phải kiến thức dạy được' },
    ])
    expect(r.objectives[0]?.mapsTo).toEqual(['count-100'])
    expect(r.applied[0]?.effect.objectivesRewired).toBe(1)
  })

  it('bỏ mà KHÔNG nêu lý do → từ chối; "vì sao khung không có cái này" phải còn câu trả lời', () => {
    const r = applyCollisionDecisions({ graph: withNoise(), objectives: [] }, [
      { kind: 'drop-concept', slug: 'specialising' as Slug, reason: '  ' },
    ])
    expect(r.rejected[0]?.code).toBe('empty-value')
    expect(r.graph.nodes).toHaveLength(2)
  })
})

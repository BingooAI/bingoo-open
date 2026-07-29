// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY } from '../src/policy'
import type { CompetencyKind } from '../src/domain'
import type { GraphData, SkillEdge, SkillNode, Slug } from '../src/contracts'
import type { SkillMastery } from '../src/mastery/observe'
import { buildGraph } from '../src/graph/build'
import { gapReport } from '../src/views/gap'

/**
 * Báo cáo này nói chuyện với một giáo viên về một đứa trẻ. Nên hai điều nó phải làm đúng đều
 * là chuyện đúng/sai, không phải chuyện trình bày:
 *
 * 1. "Chưa đạt vì đã đo và chưa tới" khác "chưa đạt vì chưa ai đo". Lẫn hai cái là đẩy giáo
 *    viên đi dạy lại thứ đứa trẻ có thể đã làm được.
 * 2. Thứ chỉ quan sát được tần suất thì không được in ra thành điểm số (ADR 0005).
 */

const kc = (slug: string, kind: CompetencyKind): SkillNode => ({
  slug: slug as Slug,
  title: { vi: slug, en: slug },
  kind,
})

const objective = (slug: string, stage?: string, strand?: string): SkillNode => ({
  slug: slug as Slug,
  title: { vi: slug, en: slug },
  kind: 'OBJECTIVE',
  ...(stage === undefined ? {} : { stage }),
  ...(strand === undefined ? {} : { strand }),
})

const mapsTo = (from: string, to: string, required = true): SkillEdge => ({
  from: from as Slug,
  to: to as Slug,
  mode: required ? 'REQUIRED' : 'RECOMMENDED',
  relType: 'MAPS_TO',
})

function states(entries: readonly (readonly [string, number, number])[]): Map<Slug, SkillMastery> {
  return new Map(
    entries.map(([slug, pKnown, attempts]) => [
      slug as Slug,
      {
        skill: slug as Slug,
        pKnown,
        ability: 1000,
        attempts,
        correct: Math.round(attempts * pKnown),
        lastSeenMs: null,
      },
    ]),
  )
}

function report(data: GraphData, st: Map<Slug, SkillMastery>, objectives: readonly string[]) {
  return gapReport(
    {
      graph: buildGraph(data),
      states: st,
      objectives: objectives.map((slug) => ({ slug: slug as Slug })),
    },
    DEFAULT_POLICY,
  )
}

describe('chưa đạt vì chưa tới, khác chưa đạt vì chưa ai đo', () => {
  const data: GraphData = {
    nodes: [
      objective('obj-tinh-toan', 'Lớp 3', 'Số học'),
      kc('kc-cong-co-nho', 'PROCEDURE'),
      kc('kc-tru-co-nho', 'PROCEDURE'),
    ],
    edges: [mapsTo('obj-tinh-toan', 'kc-cong-co-nho'), mapsTo('obj-tinh-toan', 'kc-tru-co-nho')],
  }

  it('đã đo mà chưa tới → not-yet, và nêu đích danh khái niệm nào', () => {
    const r = report(
      data,
      states([
        ['kc-cong-co-nho', 0.95, 20],
        ['kc-tru-co-nho', 0.3, 12],
      ]),
      ['obj-tinh-toan'],
    )
    const o = r.objectives[0]!
    expect(o.status).toBe('partial')
    expect(o.reason).toBe('not-yet')
    expect(o.notYet).toEqual(['kc-tru-co-nho'])
    expect(o.unevidenced).toEqual([])
    expect(r.summary.awaitingEvidence).toBe(0)
  })

  it('chưa ai đo → no-evidence, KHÔNG phải not-yet', () => {
    const r = report(data, states([['kc-cong-co-nho', 0.95, 20]]), ['obj-tinh-toan'])
    const o = r.objectives[0]!
    expect(o.reason).toBe('no-evidence')
    expect(o.unevidenced).toEqual(['kc-tru-co-nho'])
    expect(o.notYet).toEqual([])
    expect(r.summary.awaitingEvidence).toBe(1)
  })

  it('vừa có cái chưa tới vừa có cái chưa đo → không được báo là chỉ thiếu đo', () => {
    const data3: GraphData = {
      nodes: [...data.nodes, kc('kc-nhan', 'PROCEDURE')],
      edges: [...data.edges, mapsTo('obj-tinh-toan', 'kc-nhan')],
    }
    const r = report(
      data3,
      states([
        ['kc-cong-co-nho', 0.95, 20],
        ['kc-tru-co-nho', 0.3, 12],
      ]),
      ['obj-tinh-toan'],
    )
    const o = r.objectives[0]!
    expect(o.reason).toBe('not-yet')
    expect(o.notYet).toEqual(['kc-tru-co-nho'])
    expect(o.unevidenced).toEqual(['kc-nhan'])
  })

  it('đủ mọi mắt xích → achieved, không còn lý do', () => {
    const r = report(
      data,
      states([
        ['kc-cong-co-nho', 0.95, 20],
        ['kc-tru-co-nho', 0.9, 15],
      ]),
      ['obj-tinh-toan'],
    )
    const o = r.objectives[0]!
    expect(o.status).toBe('achieved')
    expect(o.reason).toBeNull()
  })

  it('coverage đếm phần ĐÃ NHÌN TỚI, không phải phần đã đạt', () => {
    const r = report(data, states([['kc-cong-co-nho', 0.1, 20]]), ['obj-tinh-toan'])
    const o = r.objectives[0]!
    expect(o.coverage).toBe(0.5) // đo 1 trong 2, dù cái đo được thì chưa đạt
    expect(o.met).toEqual([])
  })
})

/**
 * ADR 0005 cho phép ĐO thái độ/thói quen nhưng chốt rằng in ra thành phần trăm trần trụi là
 * ngoài vòng, và hoãn cưỡng chế lại cho tầng báo cáo. Đây là tầng đó, nên đây là chỗ nó phải
 * bị chặn bằng dữ liệu chứ không bằng lời dặn.
 */
describe('mục tiêu chạm tới thứ chỉ quan sát được thì không mang điểm', () => {
  it('mục tiêu thuần thái độ → evidence-only, mastery và khoảng đều rỗng', () => {
    const data: GraphData = {
      nodes: [objective('obj-hop-tac'), kc('kc-lam-viec-nhom', 'DISPOSITION')],
      edges: [mapsTo('obj-hop-tac', 'kc-lam-viec-nhom')],
    }
    const r = report(data, states([['kc-lam-viec-nhom', 0.4, 5]]), ['obj-hop-tac'])
    const o = r.objectives[0]!
    expect(o.reportMode).toBe('evidence-only')
    expect(o.mastery).toBeNull()
    expect(o.interval).toBeNull()
    // Vẫn phải nói được đã quan sát bao nhiêu lần — đó là thứ giáo viên hành động được.
    expect(o.concepts[0]!.observations).toBe(5)
  })

  it('mục tiêu TRỘN đo được và chỉ quan sát được → vẫn evidence-only', () => {
    const data: GraphData = {
      nodes: [objective('obj-tron'), kc('kc-doc-hieu', 'KNOWLEDGE'), kc('kc-thich-doc', 'DISPOSITION')],
      edges: [mapsTo('obj-tron', 'kc-doc-hieu'), mapsTo('obj-tron', 'kc-thich-doc')],
    }
    const r = report(
      data,
      states([
        ['kc-doc-hieu', 0.9, 30],
        ['kc-thich-doc', 0.5, 4],
      ]),
      ['obj-tron'],
    )
    expect(r.objectives[0]!.reportMode).toBe('evidence-only')
    expect(r.objectives[0]!.mastery).toBeNull()
  })

  it('BEHAVIOR và ATTITUDE cũng bị chặn, không chỉ DISPOSITION', () => {
    for (const kind of ['BEHAVIOR', 'ATTITUDE'] as const) {
      const data: GraphData = {
        nodes: [objective(`obj-${kind}`), kc(`kc-${kind}`, kind)],
        edges: [mapsTo(`obj-${kind}`, `kc-${kind}`)],
      }
      const r = report(data, states([[`kc-${kind}`, 0.6, 8]]), [`obj-${kind}`])
      expect(r.objectives[0]!.reportMode, kind).toBe('evidence-only')
    }
  })

  it('mục tiêu thuần kiến thức/quy trình → có điểm KÈM khoảng tin cậy', () => {
    const data: GraphData = {
      nodes: [objective('obj-so-hoc'), kc('kc-cong', 'PROCEDURE'), kc('kc-khai-niem', 'KNOWLEDGE')],
      edges: [mapsTo('obj-so-hoc', 'kc-cong'), mapsTo('obj-so-hoc', 'kc-khai-niem')],
    }
    const r = report(
      data,
      states([
        ['kc-cong', 0.9, 40],
        ['kc-khai-niem', 0.85, 30],
      ]),
      ['obj-so-hoc'],
    )
    const o = r.objectives[0]!
    expect(o.reportMode).toBe('score')
    expect(o.mastery).not.toBeNull()
    expect(o.interval).not.toBeNull()
    expect(o.interval!.lo).toBeLessThanOrEqual(o.interval!.hi)
  })

  /**
   * Bất biến này bộ test đầu tiên BỎ LỌT — nó chỉ kiểm `lo <= hi`, mà một khoảng hợp lệ vẫn có
   * thể nói về một đại lượng khác với con số in cạnh nó. Chạy trên dữ liệu demo thật mới lòi
   * ra: mục tiêu báo 28% kèm khoảng 52–79%. Một con số nằm ngoài khoảng của chính nó thì không
   * phải là kém chính xác — nó là hai phép đo khác nhau bị đặt cạnh nhau như thể cùng một phép.
   */
  it('điểm số LUÔN nằm trong khoảng của chính nó', () => {
    const cases: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, number, number]>]> = [
      // Mắt xích yếu kéo mastery xuống, trong khi phần lớn quan sát nằm ở mắt xích mạnh.
      [
        'lệch mạnh',
        [
          ['kc-manh', 0.95, 200],
          ['kc-yeu', 0.25, 12],
        ],
      ],
      [
        'lệch ngược',
        [
          ['kc-manh', 0.95, 5],
          ['kc-yeu', 0.3, 300],
        ],
      ],
      [
        'đều',
        [
          ['kc-manh', 0.7, 40],
          ['kc-yeu', 0.68, 40],
        ],
      ],
      ['một mắt xích', [['kc-manh', 0.42, 7]]],
      [
        'quan sát cực mỏng',
        [
          ['kc-manh', 0.9, 1],
          ['kc-yeu', 0.1, 1],
        ],
      ],
    ]
    const data = (slugs: readonly string[]): GraphData => ({
      nodes: [objective('obj-x'), ...slugs.map((s) => kc(s, 'KNOWLEDGE'))],
      edges: slugs.map((s) => mapsTo('obj-x', s)),
    })

    for (const [label, entries] of cases) {
      const slugs = entries.map(([s]) => s)
      const o = report(data(slugs), states(entries), ['obj-x']).objectives[0]!
      expect(o.mastery, label).not.toBeNull()
      expect(o.interval, label).not.toBeNull()
      expect(o.mastery!, `${label}: điểm dưới cận dưới`).toBeGreaterThanOrEqual(o.interval!.lo)
      expect(o.mastery!, `${label}: điểm trên cận trên`).toBeLessThanOrEqual(o.interval!.hi)
    }
  })

  /**
   * Từng in ra "Mức nắm 0% (khoảng tin cậy 0%–100%)". Khoảng thì đúng — không biết gì thật —
   * nhưng con số 0% đọc ra là *em được không điểm*, và nó vô hiệu hoá luôn câu "chưa ai đo"
   * ngay bên cạnh, vì người đọc tin con số hơn tin câu chữ. Không có bằng chứng thì không có
   * số nào để in, kể cả số 0.
   */
  it('chưa một quan sát nào → KHÔNG có điểm, kể cả 0%', () => {
    const data: GraphData = {
      nodes: [objective('obj-x'), kc('kc-x', 'KNOWLEDGE')],
      edges: [mapsTo('obj-x', 'kc-x')],
    }
    const o = report(data, new Map(), ['obj-x']).objectives[0]!
    expect(o.reportMode).toBe('score') // loại thì vẫn được phép mang điểm…
    expect(o.mastery).toBeNull() // …nhưng không có gì để mang
    expect(o.interval).toBeNull()
    expect(o.explanation.rule).toBe('no-evidence')
    expect(o.explanation.observations).toBe(0)
  })

  it('chỉ cần MỘT quan sát là có số để in trở lại', () => {
    const data: GraphData = {
      nodes: [objective('obj-x'), kc('kc-x', 'KNOWLEDGE')],
      edges: [mapsTo('obj-x', 'kc-x')],
    }
    const o = report(data, states([['kc-x', 0.2, 1]]), ['obj-x']).objectives[0]!
    expect(o.mastery).not.toBeNull()
    expect(o.interval).not.toBeNull()
    expect(o.explanation.rule).not.toBe('no-evidence')
  })

  it('dữ liệu càng mỏng, khoảng càng rộng — chỗ chưa chắc phải trông ra là chưa chắc', () => {
    const data: GraphData = {
      nodes: [objective('obj-x'), kc('kc-x', 'KNOWLEDGE')],
      edges: [mapsTo('obj-x', 'kc-x')],
    }
    const thin = report(data, states([['kc-x', 0.9, 3]]), ['obj-x']).objectives[0]!
    const thick = report(data, states([['kc-x', 0.9, 200]]), ['obj-x']).objectives[0]!
    const width = (o: typeof thin): number => o.interval!.hi - o.interval!.lo
    expect(width(thin)).toBeGreaterThan(width(thick))
  })
})

/**
 * Phần giải thích không suy luận gì mới — nó phơi ra các mảnh `nodeMastery` vốn đã dùng. Lý do
 * nó phải là dữ liệu chứ không phải một đoạn văn: một giáo viên hỏi "vì sao 28%" cần biết mắt
 * xích nào kéo xuống, không cần một câu tổng quát về thuật toán.
 */
describe('vì sao ra con số đó', () => {
  it('có mắt xích bắt buộc → luật là mắt xích yếu nhất, và chỉ đúng cái đó ràng buộc', () => {
    const data: GraphData = {
      nodes: [objective('obj-x'), kc('kc-manh', 'KNOWLEDGE'), kc('kc-yeu', 'PROCEDURE')],
      edges: [mapsTo('obj-x', 'kc-manh'), mapsTo('obj-x', 'kc-yeu')],
    }
    const o = report(
      data,
      states([
        ['kc-manh', 0.95, 50],
        ['kc-yeu', 0.3, 20],
      ]),
      ['obj-x'],
    ).objectives[0]!

    expect(o.explanation.rule).toBe('weakest-required')
    expect(o.explanation.binding).toBe('kc-yeu')
    expect(o.explanation.requiredCount).toBe(2)
    expect(o.explanation.conceptCount).toBe(2)
    expect(o.explanation.observations).toBe(70)
    expect(o.explanation.cut).toBe(DEFAULT_POLICY.certify.cut)
  })

  it('không mắt xích nào bắt buộc → luật là trung bình có trọng số', () => {
    const data: GraphData = {
      nodes: [objective('obj-x'), kc('kc-a', 'KNOWLEDGE'), kc('kc-b', 'KNOWLEDGE')],
      edges: [mapsTo('obj-x', 'kc-a', false), mapsTo('obj-x', 'kc-b', false)],
    }
    const o = report(
      data,
      states([
        ['kc-a', 0.9, 20],
        ['kc-b', 0.5, 20],
      ]),
      ['obj-x'],
    ).objectives[0]!
    expect(o.explanation.rule).toBe('weighted-average')
    expect(o.explanation.requiredCount).toBe(0)
  })

  it('khái niệm mang TÊN đọc được, không chỉ mã máy', () => {
    const data: GraphData = {
      nodes: [objective('obj-x'), kc('kc-x', 'KNOWLEDGE')],
      edges: [mapsTo('obj-x', 'kc-x')],
    }
    const o = report(data, states([['kc-x', 0.9, 10]]), ['obj-x']).objectives[0]!
    // Giao diện dựng câu từ tên; hiện slug ra cho giáo viên là để lộ mã máy.
    expect(o.concepts[0]!.title.vi).toBeTruthy()
    expect(o.concepts[0]!.title.en).toBeTruthy()
  })

  it('mục tiêu chỉ-bằng-chứng vẫn giải thích được, chỉ là không có điểm', () => {
    const data: GraphData = {
      nodes: [objective('obj-x'), kc('kc-thai-do', 'DISPOSITION')],
      edges: [mapsTo('obj-x', 'kc-thai-do')],
    }
    const o = report(data, states([['kc-thai-do', 0.6, 5]]), ['obj-x']).objectives[0]!
    expect(o.mastery).toBeNull()
    expect(o.explanation.rule).toBe('weakest-required')
    expect(o.explanation.observations).toBe(5)
  })
})

describe('trung lập với khung chương trình', () => {
  /**
   * Cùng một hàm, hai khung có cách chia bậc hoàn toàn khác nhau. `stage` chỉ được mang theo,
   * không bị diễn giải — nếu ở đây có một nhánh if hiểu "Lớp 3" thì khung CEFR sẽ vỡ.
   */
  it('nhãn bậc chỉ được mang theo, dù là "Lớp 3", "A2" hay "buổi-7"', () => {
    for (const stage of ['Lớp 3', 'A2', 'buổi-7']) {
      const data: GraphData = {
        nodes: [objective('obj-x', stage, 'mạch-nào-đó'), kc('kc-x', 'KNOWLEDGE')],
        edges: [mapsTo('obj-x', 'kc-x')],
      }
      const o = report(data, states([['kc-x', 0.9, 10]]), ['obj-x']).objectives[0]!
      expect(o.stage, stage).toBe(stage)
      expect(o.strand).toBe('mạch-nào-đó')
    }
  })

  it('khung không khai bậc cũng chạy — stage là null, không phải lỗi', () => {
    const data: GraphData = {
      nodes: [objective('obj-x'), kc('kc-x', 'KNOWLEDGE')],
      edges: [mapsTo('obj-x', 'kc-x')],
    }
    const o = report(data, states([['kc-x', 0.9, 10]]), ['obj-x']).objectives[0]!
    expect(o.stage).toBeNull()
    expect(o.strand).toBeNull()
  })
})

describe('nhánh báo cáo không tự phát năng lực từ hư không', () => {
  /**
   * Nhánh sắp trình tự dùng prior 0.25 cho khái niệm chưa gặp, để bộ chọn còn có gì mà so.
   * Nhánh báo cáo phải dùng 0: nói với giáo viên rằng đứa trẻ có sẵn một phần tư một thứ chưa
   * ai đo là bịa.
   */
  it('khái niệm chưa từng gặp được tính 0, không phải 0.25', () => {
    const data: GraphData = {
      nodes: [objective('obj-x'), kc('kc-chua-ai-do', 'KNOWLEDGE')],
      edges: [mapsTo('obj-x', 'kc-chua-ai-do')],
    }
    const o = report(data, new Map(), ['obj-x']).objectives[0]!
    expect(o.concepts[0]!.mastery).toBe(0)
    expect(o.status).toBe('none')
    // Mức nắm của KHÁI NIỆM là 0 (đúng: prior 0, không phải 0.25). Mức nắm của MỤC TIÊU thì
    // không tồn tại — chưa ai đo thì không có gì để báo cáo. Hai điều khác nhau.
    expect(o.mastery).toBeNull()
  })
})

describe('tổng hợp', () => {
  it('đếm đúng từng nhóm và tách riêng nhóm chỉ chờ được đo', () => {
    const data: GraphData = {
      nodes: [
        objective('obj-dat'),
        objective('obj-mot-phan'),
        objective('obj-chua-do'),
        kc('kc-a', 'KNOWLEDGE'),
        kc('kc-b', 'KNOWLEDGE'),
        kc('kc-c', 'KNOWLEDGE'),
        kc('kc-d', 'KNOWLEDGE'),
      ],
      edges: [
        mapsTo('obj-dat', 'kc-a'),
        mapsTo('obj-mot-phan', 'kc-b'),
        mapsTo('obj-mot-phan', 'kc-c'),
        mapsTo('obj-chua-do', 'kc-d'),
      ],
    }
    const r = report(
      data,
      states([
        ['kc-a', 0.95, 20],
        ['kc-b', 0.95, 20],
        ['kc-c', 0.2, 10],
      ]),
      ['obj-dat', 'obj-mot-phan', 'obj-chua-do'],
    )
    expect(r.summary).toEqual({
      total: 3,
      achieved: 1,
      partial: 1,
      none: 1,
      awaitingEvidence: 1,
    })
  })

  it('danh sách mục tiêu rỗng không làm vỡ gì', () => {
    const r = report({ nodes: [], edges: [] }, new Map(), [])
    expect(r.objectives).toEqual([])
    expect(r.summary.total).toBe(0)
  })
})

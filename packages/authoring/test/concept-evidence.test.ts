// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Câu trích của KIẾN THỨC phải được kiểm và phải sống qua compile.
 *
 * Hai lỗ hổng đối xứng đã tồn tại cùng lúc: đường mục tiêu kiểm câu trích còn đường kiến thức không,
 * nên mọi câu trích của kiến thức ở trạng thái "chưa biết"; và compile chở bằng chứng của mục tiêu
 * nhưng bỏ bằng chứng của kiến thức, vì hợp đồng đồ thị không có chỗ cho nó. Cộng lại: một câu AI bịa
 * về kiến thức không có cách nào lộ ra.
 */
import { describe, expect, it } from 'vitest'
import { compileDraft, runIngest, verifyEvidence } from '../src/index'
import type { AuthoringPorts, IngestDraft } from '../src/index'

const SOURCE = 'Nhận biết được chục và đơn vị, số tròn chục. Đếm, đọc, viết các số trong phạm vi 100.'

/** Cổng giả: một câu trích ĐÚNG nguyên văn, một câu BỊA — để thấy hàm phân biệt được. */
const ports: AuthoringPorts = {
  extractor: {
    extractConcepts: ({ chunkId }) => [
      {
        title: { en: 'Recognise tens and ones', vi: 'Nhận biết chục và đơn vị' },
        kind: 'KNOWLEDGE',
        subject: 'math',
        facets: { object: 'place-value', channel: 'recognize' },
        evidence: [{ chunkId, quote: 'Nhận biết được chục và đơn vị' }],
        confidence: 0.95,
      },
      {
        title: { en: 'Enjoy mathematics', vi: 'Yêu thích môn Toán' },
        kind: 'KNOWLEDGE',
        subject: 'math',
        facets: { object: 'disposition', channel: 'feel' },
        evidence: [{ chunkId, quote: 'Học sinh cần yêu thích môn Toán ngay từ lớp một' }],
        confidence: 0.9,
      },
    ],
  },
  edges: { proposeEdges: () => [] },
}

describe('verifyEvidence — một chỗ kiểm cho cả hai đường trích', () => {
  it('câu khớp nguyên văn → đã kiểm, kèm vị trí ký tự', () => {
    const r = verifyEvidence({ chunkId: 'c0', quote: 'Nhận biết được chục và đơn vị' }, SOURCE)
    expect(r.verified).toBe(true)
    expect(r.charStart).toBeGreaterThanOrEqual(0)
  })

  it('câu AI bịa → chưa kiểm, nhưng CÂU VẪN ĐƯỢC GIỮ để người duyệt tự đọc', () => {
    const r = verifyEvidence({ chunkId: 'c0', quote: 'Học sinh cần yêu thích môn Toán' }, SOURCE)
    expect(r.verified).toBe(false)
    expect(r.quote).toBe('Học sinh cần yêu thích môn Toán') // không im lặng bỏ đi
  })
})

describe('runIngest — câu trích của kiến thức được kiểm tại chỗ', () => {
  it('phân biệt được câu chép đúng khỏi câu bịa', async () => {
    const draft = await runIngest(
      { id: 's', kind: 'text', locale: 'vi', chunks: [{ id: 'c0', order: 0, text: SOURCE }] },
      ports,
    )
    const [real, invented] = draft.concepts
    expect(real?.evidence[0]?.verified).toBe(true)
    expect(invented?.evidence[0]?.verified).toBe(false)
  })

  it('kiểm vào ĐÚNG đoạn câu được trích ra, không phải cả tài liệu ghép lại', async () => {
    // Cùng câu trích, nhưng chunk này KHÔNG chứa nó → phải là chưa kiểm. Nếu ai đó đổi sang kiểm
    // vào toàn văn bản thì test này xanh sai, và một câu lấy từ trang khác sẽ được tô "từ tài liệu".
    const draft = await runIngest(
      {
        id: 's',
        kind: 'text',
        locale: 'vi',
        chunks: [{ id: 'c0', order: 0, text: 'Một đoạn không liên quan.' }],
      },
      ports,
    )
    expect(draft.concepts[0]?.evidence[0]?.verified).toBe(false)
  })
})

describe('compileDraft — bằng chứng kiến thức sống qua compile', () => {
  const draft: IngestDraft = {
    concepts: [
      {
        tempId: 'c1',
        title: { en: 'Recognise tens and ones', vi: 'Nhận biết chục và đơn vị' },
        kind: 'KNOWLEDGE',
        facets: { object: 'place-value' },
        evidence: [
          {
            chunkId: 'c0',
            quote: 'Nhận biết được chục và đơn vị',
            verified: true,
            charStart: 0,
            charEnd: 28,
          },
        ],
        confidence: 0.95,
      },
    ],
    edges: [],
    warnings: [],
  }

  it('câu trích + trạng thái đã kiểm + độ tin cậy tới được đầu ra', () => {
    const c = compileDraft(draft).concepts[0]
    expect(c?.evidence[0]?.quote).toBe('Nhận biết được chục và đơn vị')
    expect(c?.evidence[0]?.verified).toBe(true)
    expect(c?.confidence).toBe(0.95)
  })

  it('khoá theo slug ĐÃ SỐNG SÓT sau dedup — không để lại bằng chứng mồ côi', () => {
    const compiled = compileDraft(draft)
    const graphSlugs = new Set(compiled.graph.nodes.map((n) => n.slug))
    for (const c of compiled.concepts) expect(graphSlugs.has(c.slug)).toBe(true)
  })
})

// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Compile KHÔNG được đánh rơi bằng chứng nguồn của mục tiêu — nếu rơi ở đây thì làn "từ tài liệu"
 * chết trước khi kịp lưu (đúng lỗ hổng cũ: câu trích sinh ra rồi vứt ở compile).
 */

import { describe, expect, it } from 'vitest'
import { compileDraft } from '../src/index'
import type { IngestDraft } from '../src/index'

const base: IngestDraft = {
  concepts: [
    { tempId: 'c1', title: { en: 'Count within 20', vi: 'Đếm đến 20' }, kind: 'KNOWLEDGE', evidence: [] },
  ],
  edges: [],
  framework: {
    slug: 'demo',
    name: { en: 'Demo', vi: 'Demo' },
    kind: 'CURRICULUM',
    locale: 'en',
    objectives: [
      {
        tempId: 'o1',
        title: { en: 'Count objects 0 to 20', vi: 'Đếm vật 0 đến 20' },
        code: '1Nc.01',
        mapsToTempIds: ['c1'],
        evidence: [
          { chunkId: 'c0', quote: 'Count objects from 0 to 20', verified: true, charStart: 5, charEnd: 31 },
        ],
      },
    ],
  },
  warnings: [],
}

describe('compileDraft — mang bằng chứng nguồn của mục tiêu', () => {
  it('giữ nguyên evidence (câu trích + verified + offset) lên CompiledObjective', () => {
    const obj = compileDraft(base).objectives[0]
    expect(obj?.evidence?.[0]?.quote).toBe('Count objects from 0 to 20')
    expect(obj?.evidence?.[0]?.verified).toBe(true)
    expect(obj?.evidence?.[0]?.charStart).toBe(5)
  })

  it('mục tiêu KHÔNG có câu trích → evidence undefined (làn xám "không có nguồn", không phải kiểm hụt)', () => {
    const noEv: IngestDraft = {
      ...base,
      framework: {
        ...base.framework!,
        objectives: [{ tempId: 'o1', title: { en: 'X', vi: 'X' }, code: 'X', mapsToTempIds: ['c1'] }],
      },
    }
    expect(compileDraft(noEv).objectives[0]?.evidence).toBeUndefined()
  })
})

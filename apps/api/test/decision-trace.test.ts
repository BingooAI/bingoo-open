// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Dựng thẻ OBJECTIVE_EXISTS — làn nào bật là do BẰNG CHỨNG, không do lời hứa. Chạy offline.
 * Nguồn dùng ở đây tự soạn (không nguyên văn tài liệu bên thứ ba — §1).
 */

import { describe, expect, it } from 'vitest'
import type { CompiledObjective } from '@bingoo.ai/authoring'
import { buildConceptIdentityTrace, buildObjectiveTrace } from '../src/services/decision-trace.service'

const EXCERPT = 'Số và phép tính — Lớp 1. Đếm, đọc, viết các số trong phạm vi 10; 20; 100. So sánh các số.'

const objWith = (over: Partial<CompiledObjective>): CompiledObjective => ({
  slug: 'count-100',
  title: { en: 'Count to 100', vi: 'Đếm đến 100' },
  code: '1Nc.01',
  mapsTo: ['count-within-100'],
  ...over,
})

describe('buildObjectiveTrace', () => {
  it('câu trích có thật trong nguồn → làn FROM_SOURCE + quoteVerified + I5 passed', () => {
    const o = objWith({
      evidence: [{ chunkId: 'c0', quote: 'Đếm, đọc, viết các số trong phạm vi 10; 20; 100.' }],
    })
    const t = buildObjectiveTrace(o, EXCERPT)
    expect(t.basis).toBe('FROM_SOURCE')
    const span = t.evidence.find((e) => e.kind === 'SOURCE_SPAN')
    expect(span?.quoteVerified).toBe(true)
    expect(span?.basis).toBe('FROM_SOURCE')
    expect(typeof span?.charStart).toBe('number')
    const struct = t.evidence.find((e) => e.kind === 'STRUCTURAL_CHECK')
    expect(struct?.passed).toBe(true)
    expect(t.checksPassed).toContain('coverage:nonempty')
  })

  it('câu trích AI bịa (không có trong nguồn) → thẻ AI_INFERRED, quoteVerified=false', () => {
    const o = objWith({ evidence: [{ chunkId: 'c0', quote: 'Nhân chia trong phạm vi 1000.' }] })
    const t = buildObjectiveTrace(o, EXCERPT)
    expect(t.basis).toBe('AI_INFERRED')
    expect(t.evidence.find((e) => e.kind === 'SOURCE_SPAN')?.quoteVerified).toBe(false)
  })

  it('mục tiêu KHÔNG có câu trích (sinh từ chủ đề) → không có SOURCE_SPAN, thẻ AI_INFERRED', () => {
    const t = buildObjectiveTrace(objWith({}), EXCERPT)
    expect(t.basis).toBe('AI_INFERRED')
    expect(t.evidence.some((e) => e.kind === 'SOURCE_SPAN')).toBe(false)
    // vẫn có kiểm cấu trúc — làn "máy tự tính" độc lập với việc có nguồn hay không.
    expect(t.evidence.some((e) => e.kind === 'STRUCTURAL_CHECK')).toBe(true)
  })

  it('mục tiêu không neo được KC nào → I5 FAIL, checksFailed', () => {
    const t = buildObjectiveTrace(objWith({ mapsTo: [] }), EXCERPT)
    expect(t.evidence.find((e) => e.kind === 'STRUCTURAL_CHECK')?.passed).toBe(false)
    expect(t.checksFailed).toContain('coverage:nonempty')
  })
})

describe('buildConceptIdentityTrace (đóng điểm mù trigram)', () => {
  it('gộp trigram → CONCEPT_IDENTITY, TRIGRAM/AI_INFERRED, có % trong lý do, gắn vào KC sống sót', () => {
    const t = buildConceptIdentityTrace({
      tempId: 'c3',
      into: 'count-within-100',
      reason: 'within-batch',
      similarity: 0.82,
      fromTitle: 'Count up to 100',
      intoTitle: 'Count within 100',
    })
    expect(t.artifact).toBe('CONCEPT_IDENTITY')
    expect(t.method).toBe('TRIGRAM')
    expect(t.basis).toBe('AI_INFERRED') // KHÔNG phải STRUCTURAL — đó là điểm cần cảnh báo
    expect(t.subjectSlug).toBe('count-within-100')
    expect(t.reason.vi).toContain('82%')
    expect(t.claim.en).toContain('SAME')
  })
})

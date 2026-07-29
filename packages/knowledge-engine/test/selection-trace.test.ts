// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY, type EnginePolicy } from '../src/policy'
import type { Candidate, Slug } from '../src/contracts'
import type { SkillMastery } from '../src/mastery/observe'
import {
  selectAdaptiveSession,
  selectAdaptiveSessionTraced,
  type SessionContext,
  type SessionOpts,
} from '../src/sequencer/session'
import { policyFingerprint } from '../src/sequencer/trace'

/**
 * Nhật ký chọn bài tồn tại để trả lời một câu hỏi không thể trả lời muộn: "nếu hồi ấy chấm
 * khác đi thì phiên này có còn giống không". Muốn trả lời được thì nhật ký phải giữ cả những
 * ứng viên đã thua — kết quả thì `Observation` đã có, phương án bị bỏ thì không ai giữ.
 *
 * Nên bộ test này canh hai điều, và điều thứ nhất quan trọng hơn: ghi nhật ký KHÔNG ĐƯỢC đổi
 * thứ người học nhìn thấy.
 */

function mastery(skill: string, pKnown: number, ability: number, attempts: number): SkillMastery {
  return { skill: skill as Slug, pKnown, ability, attempts, correct: attempts, lastSeenMs: null }
}

function cand(key: string, skill: string, difficulty: number, kind?: string): Candidate {
  return { key, skills: [skill as Slug], difficulty, ...(kind === undefined ? {} : { kind }) }
}

/** Một lớp ứng viên đủ rộng để caps, ε-explore và declump đều có việc để làm. */
function fixture(): { ctx: SessionContext; candidates: Candidate[] } {
  const skills = ['kc-a', 'kc-b', 'kc-c']
  const states = new Map<Slug, SkillMastery>(
    skills.map((s, i) => [s as Slug, mastery(s, 0.2 + i * 0.25, 900 + i * 120, 3 + i)]),
  )
  const priority = new Map<Slug, number>(skills.map((s, i) => [s as Slug, 1.9 - i * 0.4]))
  const ctx: SessionContext = {
    states,
    priority,
    started: new Set(skills as Slug[]),
    encountered: new Set(skills as Slug[]),
  }
  const kinds = ['mcq', 'drag', 'input']
  const candidates: Candidate[] = []
  for (let i = 0; i < 18; i++) {
    const skill = skills[i % skills.length] as string
    candidates.push(cand(`item-${i}`, skill, 850 + i * 25, kinds[i % kinds.length] as string))
  }
  return { ctx, candidates }
}

const OPTS: SessionOpts = { size: 6, daySeed: '2026-07-25', explore: 0.3 }

describe('ghi nhật ký không được đổi phiên học', () => {
  it('phiên có nhật ký và phiên không nhật ký trùng khít', () => {
    const { ctx, candidates } = fixture()
    const plain = selectAdaptiveSession(ctx, candidates, OPTS, DEFAULT_POLICY)
    const { session } = selectAdaptiveSessionTraced(ctx, candidates, OPTS, DEFAULT_POLICY)
    expect(session.map((c) => c.key)).toEqual(plain.map((c) => c.key))
  })

  it('vẫn tất định: chạy hai lần ra cùng một phiên', () => {
    const { ctx, candidates } = fixture()
    const a = selectAdaptiveSessionTraced(ctx, candidates, OPTS, DEFAULT_POLICY)
    const b = selectAdaptiveSessionTraced(ctx, candidates, OPTS, DEFAULT_POLICY)
    expect(a.trace).toEqual(b.trace)
  })

  /**
   * Mốc vàng, chốt bằng cách chạy bản TRƯỚC khi thêm nhật ký trên đúng lớp ứng viên này. Nó
   * canh đúng một điều: thêm đường ghi chép không được xê dịch phiên học. Test đối chiếu hai
   * bản (300 lớp ngẫu nhiên có seed) đã chạy một lần lúc refactor và đã bỏ đi — giữ lại một
   * bản sao đông lạnh của thuật toán cũ thì tự nó thành thứ phải bảo trì.
   */
  it('phiên khớp mốc vàng chốt trước khi thêm nhật ký', () => {
    const { ctx, candidates } = fixture()
    const { session } = selectAdaptiveSessionTraced(ctx, candidates, OPTS, DEFAULT_POLICY)
    expect(session.map((c) => c.key)).toEqual(['item-0', 'item-1', 'item-3', 'item-7', 'item-14', 'item-17'])
  })
})

describe('nhật ký giữ đủ để dựng lại quyết định', () => {
  it('mọi ứng viên hợp lệ đều có mặt, kể cả ứng viên đã thua', () => {
    const { ctx, candidates } = fixture()
    const { session, trace } = selectAdaptiveSessionTraced(ctx, candidates, OPTS, DEFAULT_POLICY)

    expect(trace.offered).toBe(candidates.length)
    expect(trace.considered).toHaveLength(trace.eligible)
    // Điều đáng giá nằm ở đây: đã cân nhắc nhiều hơn hẳn số đã chọn.
    expect(trace.considered.length).toBeGreaterThan(session.length)
    expect(trace.considered.filter((c) => !c.picked).length).toBeGreaterThan(0)
  })

  it('cờ picked khớp đúng phiên đã trả về', () => {
    const { ctx, candidates } = fixture()
    const { session, trace } = selectAdaptiveSessionTraced(ctx, candidates, OPTS, DEFAULT_POLICY)

    const chosen = new Set(session.map((c) => c.key))
    for (const c of trace.considered) {
      expect(c.picked, `ứng viên ${c.key}`).toBe(chosen.has(c.key))
    }
    expect([...trace.picked].sort()).toEqual([...chosen].sort())
  })

  it('considered đã sắp hạng: bucket giảm dần, hoà thì rank tăng dần', () => {
    const { ctx, candidates } = fixture()
    const { trace } = selectAdaptiveSessionTraced(ctx, candidates, OPTS, DEFAULT_POLICY)

    for (let i = 1; i < trace.considered.length; i++) {
      const prev = trace.considered[i - 1] as (typeof trace.considered)[number]
      const cur = trace.considered[i] as (typeof trace.considered)[number]
      if (prev.bucket === cur.bucket) expect(cur.rank).toBeGreaterThanOrEqual(prev.rank)
      else expect(prev.bucket).toBeGreaterThan(cur.bucket)
    }
  })

  it('điểm thô và bucket nhất quán với nhau', () => {
    const { ctx, candidates } = fixture()
    const { trace } = selectAdaptiveSessionTraced(ctx, candidates, OPTS, DEFAULT_POLICY)
    const scale = DEFAULT_POLICY.sequencing.scoreBucket

    for (const c of trace.considered) {
      expect(c.bucket, `ứng viên ${c.key}`).toBe(Math.round(c.score * scale))
    }
  })

  it('ghi lại tham số của lượt, để sau này biết nó chạy dưới luật nào', () => {
    const { ctx, candidates } = fixture()
    const { trace } = selectAdaptiveSessionTraced(ctx, candidates, OPTS, DEFAULT_POLICY)

    expect(trace.size).toBe(6)
    expect(trace.daySeed).toBe('2026-07-25')
    expect(trace.exploreN).toBe(Math.floor(6 * Math.min(DEFAULT_POLICY.sequencing.exploreCap, 0.3)))
  })
})

/**
 * Dấu vân tay thay cho số phiên bản khai tay, vì số khai tay chỉ đúng chừng nào còn có người
 * nhớ tăng nó — và nhật ký ghi sai phiên bản còn tệ hơn nhật ký không ghi.
 */
describe('dấu vân tay policy', () => {
  it('cùng policy ra cùng dấu', () => {
    expect(policyFingerprint(DEFAULT_POLICY)).toBe(policyFingerprint(DEFAULT_POLICY))
  })

  it('đổi MỘT con số trong policy là đổi dấu', () => {
    const tweaked: EnginePolicy = {
      ...DEFAULT_POLICY,
      sequencing: { ...DEFAULT_POLICY.sequencing, matchWindow: DEFAULT_POLICY.sequencing.matchWindow + 1 },
    }
    expect(policyFingerprint(tweaked)).not.toBe(policyFingerprint(DEFAULT_POLICY))
  })

  it('không phụ thuộc thứ tự khoá khi dựng object', () => {
    const reordered = {
      certify: DEFAULT_POLICY.certify,
      evidence: DEFAULT_POLICY.evidence,
      review: DEFAULT_POLICY.review,
      sequencing: DEFAULT_POLICY.sequencing,
      beta: DEFAULT_POLICY.beta,
      confidence: DEFAULT_POLICY.confidence,
      dreyfus: DEFAULT_POLICY.dreyfus,
      mastery: DEFAULT_POLICY.mastery,
      elo: DEFAULT_POLICY.elo,
      bkt: DEFAULT_POLICY.bkt,
    } satisfies EnginePolicy
    expect(policyFingerprint(reordered)).toBe(policyFingerprint(DEFAULT_POLICY))
  })

  it('nhật ký mang đúng dấu của policy đã dùng', () => {
    const { ctx, candidates } = fixture()
    const { trace } = selectAdaptiveSessionTraced(ctx, candidates, OPTS, DEFAULT_POLICY)
    expect(trace.policy).toBe(policyFingerprint(DEFAULT_POLICY))
  })
})

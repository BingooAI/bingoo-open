// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY, type EnginePolicy, type ReviewParams, validatePolicy } from '../src/policy'
import type { CompetencyKind } from '../src/domain'
import type { GraphData, Slug } from '../src/contracts'
import type { SkillMastery } from '../src/mastery/observe'
import { halfLifeDays, reviewUrgency } from '../src/mastery/review-urgency'
import { buildGraph } from '../src/graph/build'
import { dueForReview } from '../src/sequencer/review'
import { buildPriority } from '../src/sequencer/priority'

/**
 * Một hằng số nửa đời dùng chung cho mọi loại năng lực là nói rằng phép chia có dư phai đi
 * đúng bằng tốc độ của thói quen đọc sách. Bảng theo `CompetencyKind` sửa điều đó — và chia
 * theo kind chứ không theo môn, vì "môn" là khái niệm riêng của từng khung, còn kind thì
 * khung nào cũng ánh xạ vào được.
 */

const DAY = 24 * 60 * 60 * 1000
const NOW = 100 * DAY
const daysAgo = (d: number): number => NOW - d * DAY
const r4 = (x: number): number => Math.round(x * 1e4) / 1e4

describe('đường gọi cũ không được xê dịch', () => {
  const review: ReviewParams = DEFAULT_POLICY.review

  /** Đúng bốn con số của golden C.3, chép sang đây để lần này canh nhánh KHÔNG truyền kind. */
  it('không truyền kind → y hệt số cũ', () => {
    expect(r4(reviewUrgency(0.9, daysAgo(0), NOW, review))).toBe(0)
    expect(r4(reviewUrgency(0.9, daysAgo(10), NOW, review))).toBe(0.2193)
    expect(r4(reviewUrgency(0.9, daysAgo(30), NOW, review))).toBe(0.5242)
    expect(r4(reviewUrgency(0.5, daysAgo(10), NOW, review))).toBe(0.3516)
    expect(reviewUrgency(0.9, null, NOW, review)).toBe(0)
  })

  /**
   * KNOWLEDGE cố ý được khai đúng bằng cặp tham số chung, nên trường hợp phổ biến nhất đi qua
   * nhánh mới mà ra cùng một số. Nếu ai đó chỉnh KNOWLEDGE trong bảng, test này đỏ trước.
   */
  it('KNOWLEDGE đi nhánh mới nhưng ra đúng số của nhánh chung', () => {
    for (const d of [0, 1, 10, 30, 90]) {
      expect(r4(reviewUrgency(0.9, daysAgo(d), NOW, review, 'KNOWLEDGE')), `${d} ngày`).toBe(
        r4(reviewUrgency(0.9, daysAgo(d), NOW, review)),
      )
    }
  })

  it('loại không khai trong bảng cũng rơi về nhánh chung', () => {
    expect(halfLifeDays(0.9, review, 'OBJECTIVE')).toBe(halfLifeDays(0.9, review))
  })
})

describe('thứ tự phai giữa các loại', () => {
  const review = DEFAULT_POLICY.review

  it('thủ tục phai nhanh hơn khái niệm, khái niệm nhanh hơn kỹ năng', () => {
    const proc = halfLifeDays(0.9, review, 'PROCEDURE')
    const know = halfLifeDays(0.9, review, 'KNOWLEDGE')
    const skill = halfLifeDays(0.9, review, 'SKILL')
    expect(proc).toBeLessThan(know)
    expect(know).toBeLessThan(skill)
  })

  it('cùng số ngày bỏ bẵng, thủ tục khẩn hơn khái niệm', () => {
    const proc = reviewUrgency(0.9, daysAgo(14), NOW, review, 'PROCEDURE')
    const know = reviewUrgency(0.9, daysAgo(14), NOW, review, 'KNOWLEDGE')
    expect(proc).toBeGreaterThan(know)
  })

  it('nắm càng vững thì nửa đời càng dài, ở mọi loại', () => {
    const kinds: CompetencyKind[] = ['PROCEDURE', 'KNOWLEDGE', 'SKILL', 'DISPOSITION']
    for (const k of kinds) {
      expect(halfLifeDays(0.9, review, k), k).toBeGreaterThan(halfLifeDays(0.2, review, k))
    }
  })
})

/**
 * Phần quan trọng nhất của thay đổi này, và nó không phải chuyện chỉnh tham số cho khéo.
 *
 * DISPOSITION / BEHAVIOR / ATTITUDE đo bằng Beta-Binomial — đo TẦN SUẤT quan sát được, không
 * đo lượng còn nhớ (xem `methodFor`). Đẩy chúng qua đường cong quên là hỏi "ba tuần rồi chưa
 * ôn, chắc em quên mất cách thích đọc sách?". Với hằng số chung cũ thì hệ vẫn đều đặn ném
 * chúng vào hàng chờ ôn chỉ vì thời gian trôi.
 */
describe('thái độ và thói quen không bị coi là đã quên', () => {
  const review = DEFAULT_POLICY.review

  it('sau 30 ngày, thái độ chưa tới ngưỡng đến hạn còn khái niệm thì đã qua', () => {
    const dispo = reviewUrgency(0.9, daysAgo(30), NOW, review, 'DISPOSITION')
    const know = reviewUrgency(0.9, daysAgo(30), NOW, review, 'KNOWLEDGE')
    expect(dispo).toBeLessThan(review.dueThreshold)
    expect(know).toBeGreaterThan(review.dueThreshold)
  })

  it('dueForReview: khái niệm bỏ bẵng thì lọt hàng ôn, thói quen thì không', () => {
    const data: GraphData = {
      nodes: [
        { slug: 'kc-chia-co-du' as Slug, title: { vi: 'Chia có dư' }, kind: 'PROCEDURE' },
        { slug: 'kc-so-hoc' as Slug, title: { vi: 'Số học' }, kind: 'KNOWLEDGE' },
        { slug: 'kc-thich-doc' as Slug, title: { vi: 'Thích đọc sách' }, kind: 'DISPOSITION' },
      ],
      edges: [],
    }
    const graph = buildGraph(data)
    const slugs = data.nodes.map((n) => n.slug)
    const states = new Map<Slug, SkillMastery>(
      slugs.map((s) => [
        s,
        { skill: s, pKnown: 0.95, ability: 1200, attempts: 10, correct: 9, lastSeenMs: daysAgo(30) },
      ]),
    )
    const encountered = new Set(slugs)

    const due = dueForReview(graph, states, slugs, encountered, NOW, DEFAULT_POLICY)
    const dueSlugs = due.map((d) => d.slug)

    expect(dueSlugs).toContain('kc-chia-co-du')
    expect(dueSlugs).toContain('kc-so-hoc')
    expect(dueSlugs).not.toContain('kc-thich-doc')
    // Và trong hai cái lọt, thủ tục phải đứng trước.
    expect(dueSlugs[0]).toBe('kc-chia-co-du')
  })

  it('buildPriority: thói quen xếp thấp hơn thủ tục cùng điều kiện', () => {
    const data: GraphData = {
      nodes: [
        { slug: 'kc-chia-co-du' as Slug, title: { vi: 'Chia có dư' }, kind: 'PROCEDURE' },
        { slug: 'kc-thich-doc' as Slug, title: { vi: 'Thích đọc sách' }, kind: 'DISPOSITION' },
      ],
      edges: [],
    }
    const graph = buildGraph(data)
    const slugs = data.nodes.map((n) => n.slug)
    const states = new Map<Slug, SkillMastery>(
      slugs.map((s) => [
        s,
        { skill: s, pKnown: 0.95, ability: 1200, attempts: 10, correct: 9, lastSeenMs: daysAgo(30) },
      ]),
    )
    const priority = buildPriority(graph, states, slugs, new Set(slugs), NOW, DEFAULT_POLICY)

    const proc = priority.get('kc-chia-co-du' as Slug) as number
    const dispo = priority.get('kc-thich-doc' as Slug) as number
    expect(proc).toBeGreaterThan(dispo)
  })
})

describe('policy có bảng hỏng thì ném lỗi, không âm thầm cho ra NaN', () => {
  it('nửa đời base = 0 bị chặn ở validate', () => {
    const bad: EnginePolicy = {
      ...DEFAULT_POLICY,
      review: {
        ...DEFAULT_POLICY.review,
        halfLifeByKind: { ...DEFAULT_POLICY.review.halfLifeByKind, PROCEDURE: { base: 0, slope: 14 } },
      },
    }
    expect(() => validatePolicy(bad)).toThrow(/halfLifeByKind\.PROCEDURE\.base/)
  })

  it('DEFAULT_POLICY tự nó hợp lệ', () => {
    expect(() => validatePolicy(DEFAULT_POLICY)).not.toThrow()
  })
})

/**
 * Luật TƯƠNG THÍCH — mỗi test canh MỘT lớp mâu thuẫn cụ thể. Đây là golden vectors: đổi luật mà
 * làm sai một dòng ở đây là đổi hành vi thấy được của người học.
 */

import { describe, expect, it } from 'vitest'
import { checkCompatibility, deriveCapabilities, isValid, type ExperienceDescriptor } from '../src/index'

const base: ExperienceDescriptor = {
  experience: 'learn',
  delivery: 'async',
  companion: 'ai',
  scale: 'solo',
  time: 'on-demand',
}
const d = (over: Partial<ExperienceDescriptor>): ExperienceDescriptor => ({ ...base, ...over })

describe('checkCompatibility — mâu thuẫn cứng (INVALID)', () => {
  it('trực tiếp (time=live) không chạy được trong async', () => {
    const r = checkCompatibility(d({ time: 'live', delivery: 'async' }))
    expect(r.verdict).toBe('INVALID')
    expect(r.violations.map((v) => v.rule)).toContain('live-time-needs-sync-delivery')
  })

  it('solo mà có người dạy → INVALID (đã là ≥2 người)', () => {
    expect(checkCompatibility(d({ scale: 'solo', companion: 'teacher' })).verdict).toBe('INVALID')
    expect(checkCompatibility(d({ scale: 'solo', companion: 'peer' })).verdict).toBe('INVALID')
  })

  it('solo + AI hoặc self thì hợp lệ', () => {
    expect(isValid(d({ scale: 'solo', companion: 'ai' }))).toBe(true)
    expect(isValid(d({ scale: 'solo', companion: 'self' }))).toBe(true)
  })

  it('pair cần người thật — pair + AI/self → INVALID', () => {
    expect(checkCompatibility(d({ scale: 'pair', companion: 'ai' })).verdict).toBe('INVALID')
    expect(checkCompatibility(d({ scale: 'pair', companion: 'self' })).verdict).toBe('INVALID')
    expect(isValid(d({ scale: 'pair', companion: 'mentor' }))).toBe(true)
  })

  it('classroom cần tập thể — classroom + solo/pair → INVALID', () => {
    expect(checkCompatibility(d({ delivery: 'classroom', scale: 'solo', companion: 'ai' })).verdict).toBe(
      'INVALID',
    )
    expect(
      checkCompatibility(d({ delivery: 'classroom', scale: 'pair', companion: 'teacher' })).verdict,
    ).toBe('INVALID')
  })
})

describe('checkCompatibility — lệch khuôn (DISCOURAGED)', () => {
  it('arena solo → DISCOURAGED (mất đối thủ)', () => {
    const r = checkCompatibility(d({ experience: 'arena', scale: 'solo', companion: 'ai' }))
    expect(r.verdict).toBe('DISCOURAGED')
    expect(isValid(d({ experience: 'arena', scale: 'solo', companion: 'ai' }))).toBe(true)
  })

  it('feed + group → DISCOURAGED, không INVALID (feed vốn solo/async)', () => {
    const r = checkCompatibility(
      d({ experience: 'feed', scale: 'group', companion: 'peer', delivery: 'async' }),
    )
    expect(r.verdict).toBe('DISCOURAGED')
    expect(r.violations.map((v) => v.rule)).toContain('feed-is-solo-async')
  })
})

describe('checkCompatibility — VALID + verdict tổng ưu tiên INVALID', () => {
  it('mặc định là VALID', () => {
    expect(checkCompatibility(base).verdict).toBe('VALID')
    expect(checkCompatibility(base).violations).toHaveLength(0)
  })

  it('khi có cả INVALID lẫn DISCOURAGED, verdict = INVALID', () => {
    // arena(solo→discouraged) + classroom+solo(invalid)
    const r = checkCompatibility(
      d({ experience: 'arena', delivery: 'classroom', scale: 'solo', companion: 'ai' }),
    )
    expect(r.verdict).toBe('INVALID')
  })
})

describe('deriveCapabilities', () => {
  it('gia sư AI solo → lesson-runtime + ai-tutor, không realtime/roster', () => {
    expect(deriveCapabilities(base)).toEqual(['lesson-runtime', 'ai-tutor'])
  })

  it('live arena class → matchmaking, leaderboard, realtime, roster?, social-chat', () => {
    const caps = deriveCapabilities(
      d({ experience: 'arena', delivery: 'live', companion: 'peer', scale: 'class', time: 'live' }),
    )
    expect(caps).toContain('matchmaking')
    expect(caps).toContain('leaderboard')
    expect(caps).toContain('realtime')
    expect(caps).toContain('social-chat')
  })

  it('lớp học có lịch → scheduling + roster', () => {
    const caps = deriveCapabilities(
      d({
        experience: 'learn',
        delivery: 'classroom',
        companion: 'teacher',
        scale: 'class',
        time: 'scheduled',
      }),
    )
    expect(caps).toContain('scheduling')
    expect(caps).toContain('roster')
    expect(caps).toContain('human-presence')
  })

  it('thứ tự ổn định + không trùng lặp', () => {
    const caps = deriveCapabilities(
      d({ experience: 'arena', delivery: 'live', companion: 'peer', scale: 'class', time: 'live' }),
    )
    expect(new Set(caps).size).toBe(caps.length)
  })
})

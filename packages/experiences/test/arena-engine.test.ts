/** Máy trận đấu arena — golden vectors, tất định (rng seed cố định). */
import { describe, expect, it } from 'vitest'
import { initMatch, resolveRound, specialReady, useSpecial, type MatchState } from '../src/arena/engine'

const play = (s: MatchState, corrects: boolean[], rng?: () => number) =>
  corrects.reduce((st, c) => resolveRound(st, { correct: c }, rng), s)

describe('vsAI — hai thanh máu', () => {
  it('trả lời đúng làm trùm mất máu; thắng khi trùm hết máu', () => {
    // rng luôn > 0.6 → bot LUÔN sai, không đánh trả.
    const rng = () => 0.99
    let m = initMatch({ mode: 'vsAI', totalRounds: 5 })
    m = play(m, [true, true, true], rng) // 3 × 34 = 102 ≥ 100
    expect(m.status).toBe('won')
    expect(m.foe.hp).toBe(0)
    expect(m.you.hp).toBe(100)
  })

  it('bot đúng thì bạn mất máu; thua khi bạn hết máu', () => {
    // rng luôn < 0.6 → bot LUÔN đúng, đánh 24 mỗi vòng; bạn luôn sai (không gây sát thương).
    const rng = () => 0.0
    let m = initMatch({ mode: 'vsAI', totalRounds: 10 })
    m = play(m, [false, false, false, false, false], rng) // 5 × 24 = 120 ≥ 100
    expect(m.status).toBe('lost')
    expect(m.you.hp).toBe(0)
  })
})

describe('solo — sinh tồn bằng tim', () => {
  it('sai 3 lần là thua, combo reset khi sai', () => {
    let m = initMatch({ mode: 'solo', totalRounds: 20 })
    m = resolveRound(m, { correct: true })
    expect(m.you.combo).toBe(1)
    m = play(m, [false, false, false])
    expect(m.hearts).toBe(0)
    expect(m.status).toBe('lost')
    expect(m.you.combo).toBe(0)
  })
})

describe('coop — trùm lớn 150 máu', () => {
  it('cần nhiều đòn hơn để hạ trùm', () => {
    const rng = () => 0.99 // bot sai
    let m = initMatch({ mode: 'coop', totalRounds: 10 })
    expect(m.foe.maxHp).toBe(150)
    m = play(m, [true, true, true, true], rng) // 4 × 30 = 120 < 150 → chưa thắng
    expect(m.status).toBe('playing')
    m = resolveRound(m, { correct: true }, rng) // +30 = 150
    expect(m.status).toBe('won')
  })
})

describe('năng lượng + đòn đặc biệt', () => {
  it('đủ 4 năng lượng thì mở đòn; đòn đặc biệt giáng 40 sát thương', () => {
    const rng = () => 0.99
    let m = initMatch({ mode: 'vsAI', totalRounds: 20 })
    m = play(m, [true, true], rng) // foe: 100 - 68 = 32, energy 2
    expect(specialReady(m)).toBe(false)
    m = play(m, [true, true], rng) // foe hp đã 0 ở đòn thứ 3 → won trước khi đủ energy
    // Dùng match mới để test special sạch (foe máu cao)
    let c = initMatch({ mode: 'coop', totalRounds: 20 })
    c = play(c, [true, true, true, true], rng) // energy 4, foe 150-120=30
    expect(specialReady(c)).toBe(true)
    c = useSpecial(c) // -40 → 0 → won
    expect(c.status).toBe('won')
    expect(c.you.energy).toBe(0)
  })
})

describe('thưởng tốc độ + điểm', () => {
  it('trả lời nhanh (≤6s) cộng sát thương + điểm', () => {
    const rng = () => 0.99
    const fast = resolveRound(
      initMatch({ mode: 'vsAI', totalRounds: 5 }),
      { correct: true, timeMs: 2000 },
      rng,
    )
    expect(fast.log[0]?.speedBonus).toBe(true)
    expect(fast.foe.hp).toBe(100 - (34 + 12))
    expect(fast.score).toBe(100 + 10 + 50)
  })

  it('hết vòng: thắng nếu máu bạn ≥ máu trùm', () => {
    const rng = () => 0.99
    let m = initMatch({ mode: 'vsAI', totalRounds: 1 })
    m = resolveRound(m, { correct: false }, rng) // không ai mất máu, hết vòng
    expect(m.round).toBe(1)
    expect(m.status).toBe('won') // 100 ≥ 100
  })
})

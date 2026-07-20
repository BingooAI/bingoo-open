import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY, deriveLevel, reviewUrgency } from '../../src/index'

/** SPEC Phụ lục C.3 — xếp bậc & ôn tập. */

const r4 = (x: number): number => Math.round(x * 1e4) / 1e4
const { dreyfus, review } = DEFAULT_POLICY

describe('C.3 deriveLevel', () => {
  it('{pKnown 0.50} → null (chưa tiếp thu)', () => {
    expect(deriveLevel({ pKnown: 0.5 }, dreyfus)).toBeNull()
  })
  it('{pKnown 0.85, ability 950} → novice', () => {
    expect(deriveLevel({ pKnown: 0.85, ability: 950 }, dreyfus)).toBe('novice')
  })
  it('{pKnown 0.85, ability 1050} → competent', () => {
    expect(deriveLevel({ pKnown: 0.85, ability: 1050 }, dreyfus)).toBe('competent')
  })
  it('{pKnown 0.85, ability 1180, transfer 0.7} → proficient', () => {
    expect(deriveLevel({ pKnown: 0.85, ability: 1180, transfer: 0.7 }, dreyfus)).toBe('proficient')
  })
  it('{pKnown 0.90, ability 1320, fluency .75, indep .75} → expert', () => {
    expect(deriveLevel({ pKnown: 0.9, ability: 1320, fluency: 0.75, independence: 0.75 }, dreyfus)).toBe(
      'expert',
    )
  })
  it('{pKnown 0.90, ability 1320, transfer 0.7} → proficient (thiếu fluency/indep)', () => {
    expect(deriveLevel({ pKnown: 0.9, ability: 1320, transfer: 0.7 }, dreyfus)).toBe('proficient')
  })
})

describe('C.3 reviewUrgency', () => {
  const now = 100 * 24 * 60 * 60 * 1000
  const at = (days: number): number => now - days * 24 * 60 * 60 * 1000

  it('m0.9 @0d = 0.0000', () => {
    expect(r4(reviewUrgency(0.9, at(0), now, review))).toBe(0)
  })
  it('m0.9 @10d = 0.2193', () => {
    expect(r4(reviewUrgency(0.9, at(10), now, review))).toBe(0.2193)
  })
  it('m0.9 @30d = 0.5242', () => {
    expect(r4(reviewUrgency(0.9, at(30), now, review))).toBe(0.5242)
  })
  it('m0.5 @10d = 0.3516 (phai nhanh hơn)', () => {
    expect(r4(reviewUrgency(0.5, at(10), now, review))).toBe(0.3516)
  })
  it('lastSeen=null → 0.0000', () => {
    expect(reviewUrgency(0.9, null, now, review)).toBe(0)
  })
})

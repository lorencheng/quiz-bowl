import { describe, it, expect } from 'vitest'
import { calcBonusTotal, updateBonusScore } from '../bonus'

describe('calcBonusTotal', () => {
  it('sums part points', () => {
    expect(calcBonusTotal([
      { points: 10 },
      { points: 0 },
      { points: 10 },
    ])).toBe(20)
  })

  it('returns 0 for all incorrect', () => {
    expect(calcBonusTotal([
      { points: 0 },
      { points: 0 },
      { points: 0 },
    ])).toBe(0)
  })

  it('returns 30 for all correct', () => {
    expect(calcBonusTotal([
      { points: 10 },
      { points: 10 },
      { points: 10 },
    ])).toBe(30)
  })

  it('returns 0 for empty array', () => {
    expect(calcBonusTotal([])).toBe(0)
  })
})

describe('updateBonusScore', () => {
  const initial = { total: 0, bonuses: 0, thirties: 0 }

  it('accumulates total and bonuses count', () => {
    expect(updateBonusScore(initial, 20)).toEqual({
      total: 20, bonuses: 1, thirties: 0,
    })
  })

  it('detects a 30 (all-correct bonus)', () => {
    expect(updateBonusScore(initial, 30)).toEqual({
      total: 30, bonuses: 1, thirties: 1,
    })
  })

  it('does not count non-30 as thirty', () => {
    expect(updateBonusScore(initial, 10)).toEqual({
      total: 10, bonuses: 1, thirties: 0,
    })
  })

  it('accumulates over multiple bonuses', () => {
    let score = initial
    score = updateBonusScore(score, 30)
    score = updateBonusScore(score, 10)
    score = updateBonusScore(score, 0)
    expect(score).toEqual({
      total: 40, bonuses: 3, thirties: 1,
    })
  })
})

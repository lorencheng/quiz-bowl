import { describe, it, expect } from 'vitest'
import { findPowerIndex, stripPowerMarker, calcTossupPoints, updateTossupScore } from '../tossup'

describe('findPowerIndex', () => {
  it('returns index of word containing (*)', () => {
    const words = ['The', 'answer', 'is', '(*)', 'here']
    expect(findPowerIndex(words)).toBe(3)
  })

  it('returns index when (*) is embedded in a word', () => {
    const words = ['This', 'thing(*)was', 'important']
    expect(findPowerIndex(words)).toBe(1)
  })

  it('returns -1 when no (*) present', () => {
    const words = ['No', 'power', 'marker', 'here']
    expect(findPowerIndex(words)).toBe(-1)
  })

  it('returns first occurrence if multiple (*)', () => {
    const words = ['first(*)', 'second(*)']
    expect(findPowerIndex(words)).toBe(0)
  })

  it('returns -1 for empty array', () => {
    expect(findPowerIndex([])).toBe(-1)
  })
})

describe('stripPowerMarker', () => {
  it('removes (*) from words', () => {
    const words = ['The', '(*)', 'answer']
    expect(stripPowerMarker(words)).toEqual(['The', 'answer'])
  })

  it('removes (*) embedded in a word', () => {
    const words = ['before(*)', 'after']
    expect(stripPowerMarker(words)).toEqual(['before', 'after'])
  })

  it('leaves words without (*) unchanged', () => {
    const words = ['no', 'marker', 'here']
    expect(stripPowerMarker(words)).toEqual(['no', 'marker', 'here'])
  })

  it('handles empty array', () => {
    expect(stripPowerMarker([])).toEqual([])
  })

  it('filters out words that become empty after stripping', () => {
    const words = ['hello', '(*)', 'world']
    expect(stripPowerMarker(words)).toEqual(['hello', 'world'])
  })
})

describe('calcTossupPoints', () => {
  it('returns 15 for accept before power mark', () => {
    expect(calcTossupPoints('accept', 5, 3)).toBe(15)
  })

  it('returns 10 for accept after power mark', () => {
    expect(calcTossupPoints('accept', 5, 7)).toBe(10)
  })

  it('returns 10 for accept at power mark index', () => {
    expect(calcTossupPoints('accept', 5, 5)).toBe(10)
  })

  it('returns 10 for accept with no power mark', () => {
    expect(calcTossupPoints('accept', -1, 3)).toBe(10)
  })

  it('returns -5 for reject', () => {
    expect(calcTossupPoints('reject', 5, 3)).toBe(-5)
  })

  it('returns 0 for prompt', () => {
    expect(calcTossupPoints('prompt', 5, 3)).toBe(0)
  })

  it('returns 0 for unknown directive', () => {
    expect(calcTossupPoints('unknown', 5, 3)).toBe(0)
  })
})

describe('updateTossupScore', () => {
  const initial = { correct: 0, neg: 0, total: 0, questions: 0 }

  it('increments correct and total for positive points', () => {
    expect(updateTossupScore(initial, 10)).toEqual({
      correct: 1, neg: 0, total: 10, questions: 1,
    })
  })

  it('increments correct and total for power', () => {
    expect(updateTossupScore(initial, 15)).toEqual({
      correct: 1, neg: 0, total: 15, questions: 1,
    })
  })

  it('increments neg for negative points', () => {
    expect(updateTossupScore(initial, -5)).toEqual({
      correct: 0, neg: 1, total: -5, questions: 1,
    })
  })

  it('increments only questions for zero points', () => {
    expect(updateTossupScore(initial, 0)).toEqual({
      correct: 0, neg: 0, total: 0, questions: 1,
    })
  })

  it('accumulates over multiple updates', () => {
    let score = initial
    score = updateTossupScore(score, 15)
    score = updateTossupScore(score, -5)
    score = updateTossupScore(score, 10)
    expect(score).toEqual({
      correct: 2, neg: 1, total: 20, questions: 3,
    })
  })
})

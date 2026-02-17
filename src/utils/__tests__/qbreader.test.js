import { describe, it, expect } from 'vitest'
import { normalizeAnswer, cleanParams } from '../../api/qbreader'

describe('normalizeAnswer', () => {
  it('converts "-1" to "negative 1"', () => {
    expect(normalizeAnswer('-1')).toBe('negative 1')
  })

  it('converts "-5" to "negative 5"', () => {
    expect(normalizeAnswer('-5')).toBe('negative 5')
  })

  it('leaves non-numeric strings unchanged', () => {
    expect(normalizeAnswer('Paris')).toBe('Paris')
  })

  it('leaves positive numbers unchanged', () => {
    expect(normalizeAnswer('42')).toBe('42')
  })

  it('leaves strings starting with dash but not a digit unchanged', () => {
    expect(normalizeAnswer('-ism')).toBe('-ism')
  })

  it('only converts single leading digit after dash', () => {
    // The regex is /^-(\d)/ which matches one digit
    expect(normalizeAnswer('-42')).toBe('negative 42')
  })

  it('does not convert dash in the middle', () => {
    expect(normalizeAnswer('twenty-3')).toBe('twenty-3')
  })
})

describe('cleanParams', () => {
  it('removes undefined values', () => {
    expect(cleanParams({ a: 1, b: undefined })).toEqual({ a: 1 })
  })

  it('removes null values', () => {
    expect(cleanParams({ a: 'hello', b: null })).toEqual({ a: 'hello' })
  })

  it('removes empty string values', () => {
    expect(cleanParams({ a: 'ok', b: '' })).toEqual({ a: 'ok' })
  })

  it('keeps zero values', () => {
    expect(cleanParams({ a: 0, b: 'test' })).toEqual({ a: 0, b: 'test' })
  })

  it('keeps false values', () => {
    expect(cleanParams({ a: false })).toEqual({ a: false })
  })

  it('returns empty object when all values are empty', () => {
    expect(cleanParams({ a: undefined, b: null, c: '' })).toEqual({})
  })

  it('returns empty object for empty input', () => {
    expect(cleanParams({})).toEqual({})
  })
})

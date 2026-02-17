import { describe, it, expect } from 'vitest'
import { buildChunks } from '../tts'

describe('buildChunks', () => {
  it('returns empty array for empty input', () => {
    expect(buildChunks([])).toEqual([])
  })

  it('returns single chunk for one word', () => {
    expect(buildChunks(['hello'])).toEqual([
      { text: 'hello', startIndex: 0, endIndex: 0 },
    ])
  })

  it('returns single chunk when no punctuation', () => {
    expect(buildChunks(['the', 'quick', 'brown', 'fox'])).toEqual([
      { text: 'the quick brown fox', startIndex: 0, endIndex: 3 },
    ])
  })

  it('splits at period', () => {
    const chunks = buildChunks(['Hello', 'world.', 'How', 'are', 'you'])
    expect(chunks).toEqual([
      { text: 'Hello world.', startIndex: 0, endIndex: 1 },
      { text: 'How are you', startIndex: 2, endIndex: 4 },
    ])
  })

  it('splits at question mark', () => {
    const chunks = buildChunks(['Is', 'it?', 'Yes'])
    expect(chunks).toEqual([
      { text: 'Is it?', startIndex: 0, endIndex: 1 },
      { text: 'Yes', startIndex: 2, endIndex: 2 },
    ])
  })

  it('splits at exclamation mark', () => {
    const chunks = buildChunks(['Wow!', 'Amazing'])
    expect(chunks).toEqual([
      { text: 'Wow!', startIndex: 0, endIndex: 0 },
      { text: 'Amazing', startIndex: 1, endIndex: 1 },
    ])
  })

  it('splits at semicolon', () => {
    const chunks = buildChunks(['first;', 'second'])
    expect(chunks).toEqual([
      { text: 'first;', startIndex: 0, endIndex: 0 },
      { text: 'second', startIndex: 1, endIndex: 1 },
    ])
  })

  it('splits at comma', () => {
    const chunks = buildChunks(['one,', 'two,', 'three'])
    expect(chunks).toEqual([
      { text: 'one,', startIndex: 0, endIndex: 0 },
      { text: 'two,', startIndex: 1, endIndex: 1 },
      { text: 'three', startIndex: 2, endIndex: 2 },
    ])
  })

  it('splits at colon', () => {
    const chunks = buildChunks(['note:', 'important'])
    expect(chunks).toEqual([
      { text: 'note:', startIndex: 0, endIndex: 0 },
      { text: 'important', startIndex: 1, endIndex: 1 },
    ])
  })

  it('handles multiple punctuation types', () => {
    const chunks = buildChunks(['Hello,', 'world.', 'How?', 'Fine!'])
    expect(chunks).toEqual([
      { text: 'Hello,', startIndex: 0, endIndex: 0 },
      { text: 'world.', startIndex: 1, endIndex: 1 },
      { text: 'How?', startIndex: 2, endIndex: 2 },
      { text: 'Fine!', startIndex: 3, endIndex: 3 },
    ])
  })

  it('groups words between punctuation correctly', () => {
    const chunks = buildChunks(['The', 'quick', 'brown', 'fox.', 'Jumped', 'high!'])
    expect(chunks).toEqual([
      { text: 'The quick brown fox.', startIndex: 0, endIndex: 3 },
      { text: 'Jumped high!', startIndex: 4, endIndex: 5 },
    ])
  })
})

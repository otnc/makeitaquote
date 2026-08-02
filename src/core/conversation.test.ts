import { describe, expect, it } from 'vitest'
import {
  assertHasMessages,
  assertMessageRenderable,
  effectiveConversationName,
  normalizeConversationMessage,
} from './conversation'
import { ValidationError } from './errors'

describe('normalizeConversationMessage', () => {
  it('normalizes the required fields', () => {
    const message = normalizeConversationMessage({ username: 'a', text: 'hi' })

    expect(message).toEqual({ username: 'a', text: 'hi', avatar: null })
  })

  it('keeps displayName only when given', () => {
    const withName = normalizeConversationMessage({ username: 'a', text: 'hi', displayName: 'A' })
    const without = normalizeConversationMessage({ username: 'a', text: 'hi' })

    expect(withName.displayName).toBe('A')
    expect('displayName' in without).toBe(false)
  })

  it('rejects a non-string text', () => {
    expect(() =>
      normalizeConversationMessage({ username: 'a', text: 42 as unknown as string }),
    ).toThrow(ValidationError)
  })

  it('rejects a non-string username', () => {
    expect(() =>
      normalizeConversationMessage({ username: 42 as unknown as string, text: 'hi' }),
    ).toThrow(ValidationError)
  })

  it('rejects an avatar of the wrong type', () => {
    expect(() =>
      normalizeConversationMessage({ username: 'a', text: 'hi', avatar: 42 as never }),
    ).toThrow(ValidationError)
  })
})

describe('assertMessageRenderable', () => {
  it('accepts a message with text and a username', () => {
    expect(() =>
      assertMessageRenderable({ username: 'a', text: 'hi', avatar: null }, 0),
    ).not.toThrow()
  })

  it('rejects blank text, naming the index', () => {
    expect(() => assertMessageRenderable({ username: 'a', text: '  ', avatar: null }, 3)).toThrow(
      /messages\[3\]\.text/,
    )
  })

  it('rejects a blank username', () => {
    expect(() => assertMessageRenderable({ username: ' ', text: 'hi', avatar: null }, 0)).toThrow(
      /messages\[0\]\.username/,
    )
  })
})

describe('assertHasMessages', () => {
  it('rejects an empty list', () => {
    expect(() => assertHasMessages([])).toThrow(ValidationError)
  })

  it('accepts a non-empty list', () => {
    expect(() => assertHasMessages([{ username: 'a', text: 'hi', avatar: null }])).not.toThrow()
  })
})

describe('effectiveConversationName', () => {
  it('prefers displayName over username', () => {
    expect(
      effectiveConversationName({ username: 'a', displayName: 'A', text: 'hi', avatar: null }),
    ).toBe('A')
  })

  it('falls back to username', () => {
    expect(effectiveConversationName({ username: 'a', text: 'hi', avatar: null })).toBe('a')
  })
})

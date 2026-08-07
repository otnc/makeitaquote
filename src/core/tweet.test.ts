import { describe, expect, it } from 'vitest'
import { ValidationError } from './errors'
import { fromTweet } from './tweet'

/** A tweet shaped exactly as `TweetLike` expects one. */
function tweet(overrides: Record<string, unknown> = {}) {
  return {
    text: 'just setting up my twttr',
    author: { username: 'jack', name: 'jack', avatarUrl: 'https://cdn.test/jack.png' },
    ...overrides,
  }
}

describe('fromTweet', () => {
  it('reads text, name and handle', () => {
    const quote = fromTweet(tweet())

    expect(quote.text).toBe('just setting up my twttr')
    expect(quote.username).toBe('jack')
    expect(quote.displayName).toBe('jack')
  })

  it('takes the avatar url when there is one', () => {
    const quote = fromTweet(
      tweet({ author: { username: 'a', avatarUrl: 'https://cdn.test/a.png' } }),
    )

    expect(quote.avatar).toBe('https://cdn.test/a.png')
  })

  it('is null when there is no avatar url', () => {
    const quote = fromTweet(tweet({ author: { username: 'a' } }))

    expect(quote.avatar).toBeNull()
  })

  it('falls back to the handle when the account has no display name', () => {
    const quote = fromTweet(tweet({ author: { username: 'someone', name: null } }))

    expect(quote.displayName).toBe('someone')
  })

  it('leaves the text exactly as written — no markdown or entities to resolve', () => {
    const quote = fromTweet(tweet({ text: 'check out https://t.co/xxxxx, cc @someone' }))

    expect(quote.text).toBe('check out https://t.co/xxxxx, cc @someone')
  })

  it('rejects anything that is not a tweet', () => {
    expect(() => fromTweet(null)).toThrow(ValidationError)
    expect(() => fromTweet({})).toThrow(ValidationError)
    expect(() => fromTweet({ text: 'hi' })).toThrow(ValidationError)
    expect(() => fromTweet({ author: {} })).toThrow(ValidationError)
  })
})

import { ValidationError } from './errors'
import { emptyQuote } from './quote'
import type { QuoteData, TweetLike } from './types'

function isTweetLike(value: unknown): value is TweetLike {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Partial<TweetLike>
  if (typeof candidate.text !== 'string') return false
  if (candidate.author === null || typeof candidate.author !== 'object') return false
  return typeof candidate.author.username === 'string'
}

/**
 * Derives a quote from a tweet/post.
 *
 * The X/Twitter counterpart to `fromMessage()`/`fromNote()`: quote what a
 * reader saw, which is the text exactly as written — X does not expand a
 * tweet's `t.co` links or `@handle` mentions into anything else in its own
 * timeline either, so there is nothing here to resolve or strip.
 */
export function fromTweet(tweet: unknown): QuoteData {
  if (!isTweetLike(tweet)) {
    throw new ValidationError('setFromTweet expects a tweet with `text` and `author.username`', {
      field: 'tweet',
    })
  }

  const quote = emptyQuote()
  quote.text = tweet.text
  quote.username = tweet.author.username
  quote.displayName = tweet.author.name || tweet.author.username
  quote.avatar = tweet.author.avatarUrl ?? null

  return quote
}

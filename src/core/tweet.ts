import { plainTextOf } from '../text/segment'
import { parseTwitterText } from '../text/twitterText'
import { ValidationError } from './errors'
import { emptyQuote, resolveMarkdownMode, resolveQuoteText } from './quote'
import type { MarkdownMode, QuoteData, TweetLike, TweetSourceOptions } from './types'

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
 * The X/Twitter counterpart to `fromMessage()`/`fromNote()`: quote what a reader saw, which is the text exactly as written by default — X does not expand a tweet's `t.co` links or `@handle` mentions into anything else in its own timeline either, so there is nothing here to resolve. `markdown` is the one thing worth opting into: a tweet has no markup syntax, but "Twitter bold/italic" written in Unicode Mathematical Alphanumeric Symbols is common enough to be worth rendering (or normalizing back to ASCII) on request. See `MarkdownMode`.
 */
export function fromTweet(
  tweet: unknown,
  options: TweetSourceOptions = {},
  globalMarkdown?: MarkdownMode,
): QuoteData {
  if (!isTweetLike(tweet)) {
    throw new ValidationError('setFromTweet expects a tweet with `text` and `author.username`', {
      field: 'tweet',
    })
  }

  const quote = emptyQuote()
  const mode = resolveMarkdownMode([options.markdown, globalMarkdown], 'raw')
  const resolvedText = resolveQuoteText(tweet.text, mode, () =>
    plainTextOf(parseTwitterText(tweet.text)),
  )
  quote.text = resolvedText.text
  quote.markdown = resolvedText.markdown
  quote.username = tweet.author.username
  quote.displayName = tweet.author.name || tweet.author.username
  quote.avatar = tweet.author.avatarUrl ?? null

  return quote
}

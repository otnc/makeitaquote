import { findTweetV2Author } from '@makeitaquote/utils/twitter'
import type { TweetLike } from './types'

/**
 * The slice of the official API v2's `TweetV2` (e.g. from `twitter-api-v2`)
 * `fromTwitterApiV2Tweet()` reads.
 *
 * Structural on purpose, the same reason `MessageLike` is: any object with
 * these fields works, whether or not `twitter-api-v2` itself is installed.
 */
export interface TweetV2Like {
  text: string
  author_id?: string
}

/** The slice of `UserV2` `fromTwitterApiV2Tweet()` reads. */
export interface UserV2Like {
  id: string
  username: string
  name?: string | null
  profile_image_url?: string | null
}

/**
 * Adapts an official API v2 response into `TweetLike`.
 *
 * v2 splits a tweet from its author — `tweet.author_id` names them, but the
 * author itself only comes back when the request asked for the
 * `author_id` expansion, arriving separately in `includes.users`. Fetch with
 * that expansion, then pass both halves here:
 *
 * ```ts
 * const { data: tweet, includes } = await client.v2.singleTweet(id, {
 *   expansions: ['author_id'],
 *   'tweet.fields': ['author_id'],
 *   'user.fields': ['profile_image_url'],
 * })
 * new MiQ().setFromTweet(fromTwitterApiV2Tweet(tweet, includes))
 * ```
 */
export function fromTwitterApiV2Tweet(
  tweet: TweetV2Like,
  includes?: { users?: readonly UserV2Like[] },
): TweetLike {
  const author = findTweetV2Author(tweet, includes)

  return {
    text: tweet.text,
    author: {
      username: author.username,
      name: author.name,
      avatarUrl: author.profile_image_url,
    },
  }
}

/**
 * The slice of FxTwitter's `TwitterStatus` (e.g. from the `fxtwitter`
 * package's `getStatus()`) `fromFxTwitterStatus()` reads.
 */
export interface FxTwitterStatusLike {
  text: string
  author: {
    screen_name: string
    name?: string | null
    avatar_url?: string | null
  }
}

/**
 * Adapts an FxTwitter API response into `TweetLike`.
 *
 * FxTwitter needs no API key and returns the author inline, so this is the
 * whole thing:
 *
 * ```ts
 * const { status } = await new FxTwitterV2().getStatus(id)
 * new MiQ().setFromTweet(fromFxTwitterStatus(status))
 * ```
 */
export function fromFxTwitterStatus(status: FxTwitterStatusLike): TweetLike {
  return {
    text: status.text,
    author: {
      username: status.author.screen_name,
      name: status.author.name,
      avatarUrl: status.author.avatar_url,
    },
  }
}

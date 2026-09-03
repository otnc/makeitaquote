import { describe, expect, it } from 'vitest'
import { ValidationError } from './errors'
import { fromFxTwitterStatus, fromTwitterApiV2Tweet } from './tweetAdapters'

describe('fromFxTwitterStatus', () => {
  // Captured from a live `FxTwitterV2#getStatus('20')` call — Jack Dorsey's first tweet — trimmed to the fields the adapter actually reads.
  const status = {
    text: 'just setting up my twttr',
    author: {
      screen_name: 'jack',
      name: 'jack',
      avatar_url: 'https://pbs.twimg.com/profile_images/1661201415899951105/azNjKOSH_200x200.jpg',
    },
  }

  it('maps screen_name/name/avatar_url onto TweetLike', () => {
    expect(fromFxTwitterStatus(status)).toEqual({
      text: 'just setting up my twttr',
      author: {
        username: 'jack',
        name: 'jack',
        avatarUrl: 'https://pbs.twimg.com/profile_images/1661201415899951105/azNjKOSH_200x200.jpg',
      },
    })
  })
})

describe('fromTwitterApiV2Tweet', () => {
  const tweet = { text: 'just setting up my twttr', author_id: '12' }
  const includes = {
    users: [
      { id: '12', username: 'jack', name: 'jack', profile_image_url: 'https://cdn.test/jack.png' },
    ],
  }

  it('matches the author by author_id and maps the fields onto TweetLike', () => {
    expect(fromTwitterApiV2Tweet(tweet, includes)).toEqual({
      text: 'just setting up my twttr',
      author: { username: 'jack', name: 'jack', avatarUrl: 'https://cdn.test/jack.png' },
    })
  })

  it('rejects a tweet with no matching author in includes.users', () => {
    expect(() => fromTwitterApiV2Tweet(tweet, { users: [] })).toThrow(ValidationError)
    expect(() => fromTwitterApiV2Tweet(tweet)).toThrow(ValidationError)
  })
})

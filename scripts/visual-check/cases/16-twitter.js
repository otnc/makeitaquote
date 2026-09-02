import { required } from '../fixtures.js'
import { MiQ } from '../library.js'

export const group = '16-twitter'

export const cases = [
  {
    name: 'a tweet, quoted via setFromTweet',
    build: () =>
      new MiQ().setFromTweet({
        text: 'just setting up my twttr',
        author: { username: 'jack', name: 'jack', avatarUrl: required.png },
      }),
    note: 'text goes through exactly as written — nothing here to strip or resolve',
  },
  {
    name: 'no display name — falls back to the handle',
    build: () =>
      new MiQ().setFromTweet({
        text: 'a tweet from an account with no display name set',
        author: { username: 'someone', avatarUrl: null },
      }),
  },
]

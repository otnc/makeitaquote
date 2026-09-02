// --- 16-twitter: setFromTweet() ---------------------------------------------

export default function registerTwitter(add, { MiQ, required }) {
  add(
    '16-twitter',
    'a tweet, quoted via setFromTweet',
    () =>
      new MiQ().setFromTweet({
        text: 'just setting up my twttr',
        author: { username: 'jack', name: 'jack', avatarUrl: required.png },
      }),
    { note: 'text goes through exactly as written — nothing here to strip or resolve' },
  )
  add('16-twitter', 'no display name — falls back to the handle', () =>
    new MiQ().setFromTweet({
      text: 'a tweet from an account with no display name set',
      author: { username: 'someone', avatarUrl: null },
    }),
  )
}

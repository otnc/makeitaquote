import { avatars, base } from '../fixtures.js'
import { stripMarkdown } from '../library.js'

export const group = '15-markdown'

const sample = [
  '# A quote from **elsewhere**',
  '',
  'Not Discord, not Misskey — a blog post, a GitHub comment, a Mastodon toot.',
  '',
  '- plain CommonMark',
  '- [a link](https://example.com) becomes just its label',
].join('\n')

export const cases = [
  {
    name: 'plain text, quoted as written',
    build: () => base().setText(sample).setAvatar(avatars.illustration),
    note: '.setText() does not strip markdown on its own — compare with the next card',
  },
  {
    name: 'stripMarkdown(text) composed with setText',
    build: () => base().setText(stripMarkdown(sample)).setAvatar(avatars.illustration),
  },
]

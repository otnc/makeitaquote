// --- 15-markdown: stripMarkdown(), for anything that isn't Discord or Misskey

const commonMarkdownSample = [
  '# A quote from **elsewhere**',
  '',
  'Not Discord, not Misskey — a blog post, a GitHub comment, a Mastodon toot.',
  '',
  '- plain CommonMark',
  '- [a link](https://example.com) becomes just its label',
].join('\n')

export default function registerMarkdown(add, { base, avatars, stripMarkdown }) {
  add(
    '15-markdown',
    'plain text, quoted as written',
    () => base().setText(commonMarkdownSample).setAvatar(avatars.illustration),
    { note: '.setText() does not strip markdown on its own — compare with the next card' },
  )
  add('15-markdown', 'stripMarkdown(text) composed with setText', () =>
    base().setText(stripMarkdown(commonMarkdownSample)).setAvatar(avatars.illustration),
  )
}

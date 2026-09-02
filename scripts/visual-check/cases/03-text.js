import { avatars, base, text } from '../fixtures.js'

export const group = '03-text'

export const cases = [
  { name: 'short', build: () => base().setText(text.short).setAvatar(avatars.illustration) },
  {
    name: 'long — wraps and shrinks',
    build: () => base().setText(text.jaLong).setAvatar(avatars.illustration),
  },
  {
    name: 'english wraps at spaces',
    build: () => base().setText(text.en).setAvatar(avatars.illustration),
  },
  {
    name: 'kinsoku — no stranded punctuation',
    build: () => base().setText(text.kinsoku).setAvatar(avatars.illustration),
  },
  {
    name: 'phraseBreak off — breaks per character',
    build: () =>
      base()
        .setText(text.jaLong)
        .setAvatar(avatars.illustration)
        .setTheme({ text: { phraseBreak: false } }),
    note: 'compare with "long — wraps and shrinks"',
  },
  {
    name: 'explicit newlines',
    build: () => base().setText(text.newlines).setAvatar(avatars.illustration),
  },
  {
    name: 'long url is force-broken',
    build: () => base().setText(text.url).setAvatar(avatars.illustration),
  },
  {
    name: 'overflow: ellipsis (default)',
    build: () => base().setText(text.veryLong).setAvatar(avatars.illustration),
  },
  {
    name: 'overflow: shrink',
    build: () =>
      base()
        .setText(text.veryLong)
        .setAvatar(avatars.illustration)
        .setTheme({ text: { overflow: 'shrink' } }),
  },
  {
    name: 'left aligned',
    build: () =>
      base()
        .setText(text.jaLong)
        .setAvatar(avatars.illustration)
        .setTheme({ text: { align: 'left' } }),
  },
]

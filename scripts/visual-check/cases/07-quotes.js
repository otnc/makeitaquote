import { avatars, base, text } from '../fixtures.js'

export const group = '07-quotes'

export const cases = [
  { name: 'none (default)', build: () => base().setText(text.ja).setAvatar(avatars.illustration) },
  {
    name: 'inline',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.illustration)
        .setTheme({ quoteMark: { display: 'inline' } }),
  },
  {
    name: 'inline with 「」',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.illustration)
        .setTheme({ quoteMark: { display: 'inline', chars: ['「', '」'] } }),
  },
  {
    name: 'block',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.illustration)
        .setTheme({ quoteMark: { display: 'block' } }),
  },
  {
    name: 'divider',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.illustration)
        .setTheme({ divider: { enabled: true } }),
  },
]

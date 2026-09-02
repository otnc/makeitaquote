import { avatars, base, text } from '../fixtures.js'

export const group = '05-typography'

export const cases = [
  {
    name: 'normal (default)',
    build: () => base().setText(text.wrapping).setAvatar(avatars.illustration),
  },
  {
    name: 'bold',
    build: () =>
      base()
        .setText(text.wrapping)
        .setAvatar(avatars.illustration)
        .setTheme({ text: { weight: 'bold' } }),
    note: 'emulated by stroking when the font has no bold face',
  },
  {
    name: 'weight 900',
    build: () =>
      base()
        .setText(text.wrapping)
        .setAvatar(avatars.illustration)
        .setTheme({ text: { weight: 900 } }),
  },
  {
    name: 'everything bold',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.illustration)
        .setTheme({
          text: { weight: 'bold' },
          displayName: { weight: 'bold' },
          username: { weight: 'bold' },
          watermark: { weight: 'bold' },
        }),
  },
]

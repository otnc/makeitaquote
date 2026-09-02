import { avatars, base, text } from '../fixtures.js'

export const group = '01-themes'

export const cases = [
  {
    name: 'dark (default)',
    build: () => base().setText(text.jaLong).setAvatar(avatars.illustration),
  },
  {
    name: 'light',
    build: () => base().setText(text.jaLong).setAvatar(avatars.illustration).setTheme('light'),
  },
  {
    name: 'color (avatar keeps its color)',
    build: () =>
      base()
        .setText(text.jaLong)
        .setAvatar(avatars.illustration)
        .setTheme({ avatar: { grayscale: false } }),
  },
  {
    name: 'new',
    build: () =>
      base().setText(text.short).setAvatar(avatars.illustration).setTheme({ layout: 'new' }),
  },
  {
    name: 'new (light)',
    build: () =>
      base()
        .setText(text.short)
        .setAvatar(avatars.illustration)
        .setTheme({ extends: 'light', layout: 'new' }),
  },
]

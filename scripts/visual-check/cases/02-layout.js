import { avatars, base, text } from '../fixtures.js'

export const group = '02-layout'

export const cases = [
  {
    name: 'avatar left (default)',
    build: () => base().setText(text.jaLong).setAvatar(avatars.illustration),
  },
  {
    name: 'avatar right — text, gradient and watermark all follow',
    build: () =>
      base()
        .setText(text.jaLong)
        .setAvatar(avatars.illustration)
        .setTheme({ avatar: { position: 'right' } }),
    note: "text.area and watermark.position are 'auto' by default",
  },
  {
    name: 'narrow avatar',
    build: () =>
      base()
        .setText(text.jaLong)
        .setAvatar(avatars.illustration)
        .setTheme({
          avatar: { widthRatio: 0.32 },
          gradient: { startRatio: 0.14, endRatio: 0.32 },
        }),
  },
  {
    name: 'new layout on a landscape canvas',
    build: () =>
      base()
        .setText(text.short)
        .setAvatar(avatars.photo)
        .setTheme({ layout: 'new', width: 1280, height: 720 }),
  },
  {
    name: 'no gradient',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.illustration)
        .setTheme({ gradient: { enabled: false } }),
  },
  {
    name: 'circular avatar',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.illustration)
        .setTheme({ avatar: { shape: 'circle', widthRatio: 0.32 }, gradient: { enabled: false } }),
    note: 'clipped to the largest circle that fits the box; the fallback tile matches',
  },
]

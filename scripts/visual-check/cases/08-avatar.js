import { avatars, base, text } from '../fixtures.js'

export const group = '08-avatar'

export const cases = [
  {
    name: 'illustration (png with alpha)',
    build: () => base().setText(text.ja).setAvatar(avatars.illustration),
  },
  { name: 'photo (jpg)', build: () => base().setText(text.ja).setAvatar(avatars.photo) },
  {
    name: 'color kept',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.photo)
        .setTheme({ avatar: { grayscale: false } }),
  },
  {
    name: 'from a remote url',
    build: () => base().setText(text.ja).setAvatar(avatars.url),
    network: true,
  },
  { name: 'from a Buffer', build: () => base().setText(text.ja).setAvatar(avatars.buffer) },
  {
    name: 'none — fallback tile with initial',
    build: () => base().setText(text.ja).setAvatar(avatars.none),
  },
  {
    name: 'unreachable url — same fallback',
    build: () => base().setText(text.ja).setAvatar(avatars.broken),
  },
  {
    name: 'no fallback tile at all',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.none)
        .setTheme({ avatar: { fallback: null } }),
  },
]

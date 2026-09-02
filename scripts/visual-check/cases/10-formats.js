import { avatars, base, text } from '../fixtures.js'

export const group = '10-formats'

export const cases = [
  {
    name: 'png',
    build: () => base().setText(text.ja).setAvatar(avatars.illustration),
    format: 'png',
  },
  {
    name: 'jpeg q40 (visibly lossy)',
    build: () => base().setText(text.ja).setAvatar(avatars.illustration),
    format: 'jpeg',
    encodeOptions: { quality: 40 },
  },
  {
    name: 'webp q90',
    build: () => base().setText(text.ja).setAvatar(avatars.illustration),
    format: 'webp',
    encodeOptions: { quality: 90 },
  },
  {
    name: 'avif q60',
    build: () => base().setText(text.ja).setAvatar(avatars.illustration),
    format: 'avif',
    encodeOptions: { quality: 60 },
  },
]

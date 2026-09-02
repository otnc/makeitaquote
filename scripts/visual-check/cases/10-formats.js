// --- 10-formats ------------------------------------------------------------

export default function registerFormats(add, { base, text, avatars }) {
  add('10-formats', 'png', () => base().setText(text.ja).setAvatar(avatars.illustration), {
    format: 'png',
  })
  add(
    '10-formats',
    'jpeg q40 (visibly lossy)',
    () => base().setText(text.ja).setAvatar(avatars.illustration),
    { format: 'jpeg', encodeOptions: { quality: 40 } },
  )
  add('10-formats', 'webp q90', () => base().setText(text.ja).setAvatar(avatars.illustration), {
    format: 'webp',
    encodeOptions: { quality: 90 },
  })
  add('10-formats', 'avif q60', () => base().setText(text.ja).setAvatar(avatars.illustration), {
    format: 'avif',
    encodeOptions: { quality: 60 },
  })
}

// --- 09-sizing: scale and fitting ---------------------------------------------

export default function registerSizing(add, { base, text, avatars }) {
  add(
    '09-sizing',
    'default (630 tall)',
    () => base().setText(text.ja).setAvatar(avatars.illustration),
    { expect: { height: 630 } },
  )
  add(
    '09-sizing',
    'scale 0.5',
    () => base().setText(text.ja).setAvatar(avatars.illustration).setScale(0.5),
    { expect: { height: 315 }, note: 'the same layout at half the resolution' },
  )
  add(
    '09-sizing',
    'scale 2',
    () => base().setText(text.ja).setAvatar(avatars.illustration).setScale(2),
    { expect: { height: 1260 } },
  )
  add(
    '09-sizing',
    'sized to the avatar height',
    () => base({ sizeToAvatar: 'height' }).setText(text.ja).setAvatar(avatars.illustration),
    { note: 'the avatar is drawn at its native resolution, never resampled' },
  )
  add('09-sizing', 'avatar contained rather than cropped', () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.photo)
      .setTheme({ avatar: { fit: 'contain' } }),
  )
}

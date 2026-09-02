import { avatars, base, text } from '../fixtures.js'

export const group = '09-sizing'

export const cases = [
  {
    name: 'default (630 tall)',
    build: () => base().setText(text.ja).setAvatar(avatars.illustration),
    expect: { height: 630 },
  },
  {
    name: 'scale 0.5',
    build: () => base().setText(text.ja).setAvatar(avatars.illustration).setScale(0.5),
    expect: { height: 315 },
    note: 'the same layout at half the resolution',
  },
  {
    name: 'scale 2',
    build: () => base().setText(text.ja).setAvatar(avatars.illustration).setScale(2),
    expect: { height: 1260 },
  },
  {
    name: 'sized to the avatar height',
    build: () => base({ sizeToAvatar: 'height' }).setText(text.ja).setAvatar(avatars.illustration),
    note: 'the avatar is drawn at its native resolution, never resampled',
  },
  {
    name: 'avatar contained rather than cropped',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.photo)
        .setTheme({ avatar: { fit: 'contain' } }),
  },
]

import { avatars, base, text } from '../fixtures.js'

export const group = '12-colors'

export const cases = [
  {
    name: 'tokyo night',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.illustration)
        .setTheme({
          extends: 'custom',
          background: '#1A1B26',
          text: { color: '#C0CAF5' },
          displayName: { color: '#7AA2F7' },
          username: { color: '#565F89' },
          watermark: { color: '#414868' },
        }),
    note: 'custom starts fully transparent; every color here is set explicitly',
  },
  {
    name: 'nord',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.illustration)
        .setTheme({
          extends: 'custom',
          background: 0x2e3440,
          text: { color: 0xeceff4 },
          displayName: { color: 0x88c0d0 },
          username: { color: 0x4c566a },
          watermark: { color: 0x434c5e },
        }),
    note: 'the same thing written as 0xRRGGBB numbers',
  },
  {
    name: 'CSS colour names and hsl()',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.illustration)
        .setTheme({
          extends: 'custom',
          background: 'midnightblue',
          text: { color: 'lavender' },
          displayName: { color: 'hsl(45, 100%, 70%)' },
          username: { color: 'slategray' },
        }),
    note: 'strings go through the color package, so all of CSS is available',
  },
  {
    name: 'solarized, as rgba arrays',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.illustration)
        .setTheme({
          extends: 'custom',
          background: [0, 43, 54, 1],
          text: { color: [253, 246, 227, 1] },
          displayName: { color: [42, 161, 152, 1] },
          username: { color: [88, 110, 117, 1] },
          watermark: { color: [7, 54, 66, 1] },
        }),
  },
  {
    name: 'translucent background over the avatar',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.illustration)
        .setTheme({
          extends: 'custom',
          layout: 'new',
          background: '#000000A0',
          gradient: { enabled: false },
          text: { color: '#FFFFFF' },
          displayName: { color: '#FFFFFF' },
          username: { color: '#CCCCCC' },
          watermark: { color: '#888888' },
        }),
    note: '#RRGGBBAA — the avatar shows through the wash',
  },
  {
    name: 'transparent background (checkerboard is the page)',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.none)
        .setTheme({
          extends: 'custom',
          text: { color: '#FFFFFF' },
          displayName: { color: '#FFFFFF' },
          username: { color: '#AAAAAA' },
        }),
    note: 'nothing is painted where the background would be',
  },
  {
    name: 'background image',
    build: () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.none)
        .setTheme({
          extends: 'custom',
          background: '#000000',
          backgroundImage: { source: avatars.photo, fit: 'cover', opacity: 0.5 },
          text: { color: '#FFFFFF' },
          displayName: { color: '#FFFFFF' },
          username: { color: '#CCCCCC' },
        }),
    note: 'a photo behind the quote, dimmed by backgroundImage.opacity',
  },
]

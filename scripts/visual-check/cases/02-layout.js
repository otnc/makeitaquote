// --- 02-layout: arrangement, not styling ------------------------------------

export default function registerLayout(add, { base, text, avatars }) {
  add('02-layout', 'avatar left (default)', () =>
    base().setText(text.jaLong).setAvatar(avatars.illustration),
  )
  add(
    '02-layout',
    'avatar right — text, gradient and watermark all follow',
    () =>
      base()
        .setText(text.jaLong)
        .setAvatar(avatars.illustration)
        .setTheme({ avatar: { position: 'right' } }),
    { note: "text.area and watermark.position are 'auto' by default" },
  )
  add('02-layout', 'narrow avatar', () =>
    base()
      .setText(text.jaLong)
      .setAvatar(avatars.illustration)
      .setTheme({
        avatar: { widthRatio: 0.32 },
        gradient: { startRatio: 0.14, endRatio: 0.32 },
      }),
  )
  add('02-layout', 'new layout on a landscape canvas', () =>
    base()
      .setText(text.short)
      .setAvatar(avatars.photo)
      .setTheme({ layout: 'new', width: 1280, height: 720 }),
  )
  add('02-layout', 'no gradient', () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.illustration)
      .setTheme({ gradient: { enabled: false } }),
  )
  add(
    '02-layout',
    'circular avatar',
    () =>
      base()
        .setText(text.ja)
        .setAvatar(avatars.illustration)
        .setTheme({ avatar: { shape: 'circle', widthRatio: 0.32 }, gradient: { enabled: false } }),
    { note: 'clipped to the largest circle that fits the box; the fallback tile matches' },
  )
}

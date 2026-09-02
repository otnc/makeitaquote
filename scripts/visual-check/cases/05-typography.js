// --- 05-typography: weight ---------------------------------------------------

export default function registerTypography(add, { base, text, avatars }) {
  add('05-typography', 'normal (default)', () =>
    base().setText(text.wrapping).setAvatar(avatars.illustration),
  )
  add(
    '05-typography',
    'bold',
    () =>
      base()
        .setText(text.wrapping)
        .setAvatar(avatars.illustration)
        .setTheme({ text: { weight: 'bold' } }),
    { note: 'emulated by stroking when the font has no bold face' },
  )
  add('05-typography', 'weight 900', () =>
    base()
      .setText(text.wrapping)
      .setAvatar(avatars.illustration)
      .setTheme({ text: { weight: 900 } }),
  )
  add('05-typography', 'everything bold', () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.illustration)
      .setTheme({
        text: { weight: 'bold' },
        displayName: { weight: 'bold' },
        username: { weight: 'bold' },
        watermark: { weight: 'bold' },
      }),
  )
}

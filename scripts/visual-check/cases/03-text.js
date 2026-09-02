// --- 03-text: wrapping and fitting ------------------------------------------

export default function registerText(add, { base, text, avatars }) {
  add('03-text', 'short', () => base().setText(text.short).setAvatar(avatars.illustration))
  add('03-text', 'long — wraps and shrinks', () =>
    base().setText(text.jaLong).setAvatar(avatars.illustration),
  )
  add('03-text', 'english wraps at spaces', () =>
    base().setText(text.en).setAvatar(avatars.illustration),
  )
  add('03-text', 'kinsoku — no stranded punctuation', () =>
    base().setText(text.kinsoku).setAvatar(avatars.illustration),
  )
  add(
    '03-text',
    'phraseBreak off — breaks per character',
    () =>
      base()
        .setText(text.jaLong)
        .setAvatar(avatars.illustration)
        .setTheme({ text: { phraseBreak: false } }),
    { note: 'compare with "long — wraps and shrinks"' },
  )
  add('03-text', 'explicit newlines', () =>
    base().setText(text.newlines).setAvatar(avatars.illustration),
  )
  add('03-text', 'long url is force-broken', () =>
    base().setText(text.url).setAvatar(avatars.illustration),
  )
  add('03-text', 'overflow: ellipsis (default)', () =>
    base().setText(text.veryLong).setAvatar(avatars.illustration),
  )
  add('03-text', 'overflow: shrink', () =>
    base()
      .setText(text.veryLong)
      .setAvatar(avatars.illustration)
      .setTheme({ text: { overflow: 'shrink' } }),
  )
  add('03-text', 'left aligned', () =>
    base()
      .setText(text.jaLong)
      .setAvatar(avatars.illustration)
      .setTheme({ text: { align: 'left' } }),
  )
}

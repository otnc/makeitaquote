// --- 07-quotes: quote marks and divider ---------------------------------------

export default function registerQuotes(add, { base, text, avatars }) {
  add('07-quotes', 'none (default)', () => base().setText(text.ja).setAvatar(avatars.illustration))
  add('07-quotes', 'inline', () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.illustration)
      .setTheme({ quoteMark: { display: 'inline' } }),
  )
  add('07-quotes', 'inline with 「」', () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.illustration)
      .setTheme({ quoteMark: { display: 'inline', chars: ['「', '」'] } }),
  )
  add('07-quotes', 'block', () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.illustration)
      .setTheme({ quoteMark: { display: 'block' } }),
  )
  add('07-quotes', 'divider', () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.illustration)
      .setTheme({ divider: { enabled: true } }),
  )
}

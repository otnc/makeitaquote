// --- 01-themes: palette/layout/color combinations, side by side ------------

export default function registerThemes(add, { base, text, avatars }) {
  add('01-themes', 'dark (default)', () =>
    base().setText(text.jaLong).setAvatar(avatars.illustration),
  )
  add('01-themes', 'light', () =>
    base().setText(text.jaLong).setAvatar(avatars.illustration).setTheme('light'),
  )
  add('01-themes', 'color (avatar keeps its color)', () =>
    base()
      .setText(text.jaLong)
      .setAvatar(avatars.illustration)
      .setTheme({ avatar: { grayscale: false } }),
  )
  add('01-themes', 'new', () =>
    base().setText(text.short).setAvatar(avatars.illustration).setTheme({ layout: 'new' }),
  )
  add('01-themes', 'new (light)', () =>
    base()
      .setText(text.short)
      .setAvatar(avatars.illustration)
      .setTheme({ extends: 'light', layout: 'new' }),
  )
}

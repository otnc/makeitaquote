// --- 17-all-themes: every palette × layout combination, plus every named
// color theme — the exhaustive counterpart to the curated highlights in
// 01-themes ------------------------------------------------------------

const CUSTOM_DEMO_COLORS = {
  background: '#1A1B26',
  text: { color: '#C0CAF5' },
  displayName: { color: '#7AA2F7' },
  username: { color: '#565F89' },
  watermark: { color: '#414868' },
}

export default function registerAllThemes(
  add,
  {
    base,
    text,
    avatars,
    COLOR_THEME_CATALOGUE,
    CUSTOM_COLOR_THEME_CATALOGUE,
    colorThemeGradient,
    colorThemeTextBase,
  },
) {
  for (const palette of ['dark', 'light', 'custom']) {
    for (const layout of ['side', 'new']) {
      add(
        '17-all-themes',
        `${palette} / ${layout}`,
        () =>
          base()
            .setText(text.short)
            .setAvatar(avatars.illustration)
            .setTheme({
              extends: palette,
              layout,
              ...(palette === 'custom' ? CUSTOM_DEMO_COLORS : {}),
            }),
        palette === 'custom'
          ? { note: 'custom starts fully transparent; colors set explicitly here' }
          : {},
      )
    }
  }

  for (const colorTheme of COLOR_THEME_CATALOGUE) {
    add('17-all-themes', colorTheme.label, () =>
      base()
        .setText(text.short)
        .setAvatar(avatars.illustration)
        .setTheme({
          extends: colorThemeTextBase(colorTheme.key),
          backgroundGradient: colorThemeGradient(colorTheme.key),
        }),
    )
  }

  for (const colorTheme of CUSTOM_COLOR_THEME_CATALOGUE) {
    add(
      '17-all-themes',
      colorTheme.label,
      () =>
        base()
          .setText(text.short)
          .setAvatar(avatars.illustration)
          .setTheme({
            extends: colorThemeTextBase(colorTheme.key),
            backgroundGradient: colorThemeGradient(colorTheme.key),
          }),
      { note: 'CUSTOM_COLOR_THEME_CATALOGUE — not in the official 21' },
    )
  }
}

import { avatars, base, text } from '../fixtures.js'
import {
  COLOR_THEME_CATALOGUE,
  CUSTOM_COLOR_THEME_CATALOGUE,
  colorThemeGradient,
  colorThemeTextBase,
} from '../library.js'

export const group = '17-all-themes'

const CUSTOM_DEMO_COLORS = {
  background: '#1A1B26',
  text: { color: '#C0CAF5' },
  displayName: { color: '#7AA2F7' },
  username: { color: '#565F89' },
  watermark: { color: '#414868' },
}

const paletteLayoutCases = ['dark', 'light', 'custom'].flatMap((palette) =>
  ['side', 'new'].map((layout) => ({
    name: `${palette} / ${layout}`,
    build: () =>
      base()
        .setText(text.short)
        .setAvatar(avatars.illustration)
        .setTheme({
          extends: palette,
          layout,
          ...(palette === 'custom' ? CUSTOM_DEMO_COLORS : {}),
        }),
    ...(palette === 'custom'
      ? { note: 'custom starts fully transparent; colors set explicitly here' }
      : {}),
  })),
)

function colorThemeCase(colorTheme, extra = {}) {
  return {
    name: colorTheme.label,
    build: () =>
      base()
        .setText(text.short)
        .setAvatar(avatars.illustration)
        .setTheme({
          extends: colorThemeTextBase(colorTheme.key),
          backgroundGradient: colorThemeGradient(colorTheme.key),
        }),
    ...extra,
  }
}

export const cases = [
  ...paletteLayoutCases,
  ...COLOR_THEME_CATALOGUE.map((colorTheme) => colorThemeCase(colorTheme)),
  ...CUSTOM_COLOR_THEME_CATALOGUE.map((colorTheme) =>
    colorThemeCase(colorTheme, { note: 'CUSTOM_COLOR_THEME_CATALOGUE — not in the official 21' }),
  ),
]

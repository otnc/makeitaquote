import type { ColorInput } from './color'
import type { BackgroundGradientTheme } from './types'

/**
 * Named background presets, one row each — the single source
 * `COLOR_THEME_CATALOGUE` and `COLOR_THEME_ALIASES` are both built from,
 * the same way `FONTS` is for fonts (`font/catalogue.ts`).
 *
 * `alias` is a short `theme=`-style option name; `null` for none.
 * `textBase` is which of this package's own `dark`/`light` text palettes
 * the theme needs for contrast, fixed per theme rather than left to a
 * `dark`/`light` choice — a pale gradient with white text (or a rich one
 * with black text) would be illegible.
 *
 * Plain black/white aren't here: they're flat colors, not gradients, and
 * this package already has them as the `dark`/`light` presets themselves.
 */
const COLOR_THEMES = [
  {
    key: 'sunset',
    label: 'Sunset',
    gradient: ['#483B72', '#C67B43'],
    textBase: 'dark',
    alias: 'ss',
  },
  {
    key: 'chroma_glow',
    label: 'Chroma Glow',
    gradient: ['#3188A8', '#AA3139'],
    textBase: 'dark',
    alias: 'cg',
  },
  {
    key: 'forest',
    label: 'Forest',
    gradient: ['#31974B', '#AE8B0C'],
    textBase: 'dark',
    alias: null,
  },
  {
    key: 'crimson_moon',
    label: 'Crimson Moon',
    gradient: ['#940000', '#200000'],
    textBase: 'dark',
    alias: 'cm',
  },
  {
    key: 'midnight_blurple',
    label: 'Midnight Blurple',
    gradient: ['#4550BD', '#151738'],
    textBase: 'dark',
    alias: 'mb',
  },
  { key: 'mars', label: 'Mars', gradient: ['#623800', '#623800'], textBase: 'dark', alias: null },
  { key: 'dusk', label: 'Dusk', gradient: ['#59606E', '#102A5C'], textBase: 'dark', alias: null },
  {
    key: 'under_the_sea',
    label: 'Under the Sea',
    gradient: ['#005243', '#005243'],
    textBase: 'dark',
    alias: 'uts',
  },
  {
    key: 'retro_storm',
    label: 'Retro Storm',
    gradient: ['#15809A', '#4D169E'],
    textBase: 'dark',
    alias: 'rs',
  },
  {
    key: 'neon_nights',
    label: 'Neon Nights',
    gradient: ['#299978', '#912D70'],
    textBase: 'dark',
    alias: 'nn',
  },
  {
    key: 'strawberry_lemonade',
    label: 'Strawberry Lemonade',
    gradient: ['#CA29A5', '#CBA826'],
    textBase: 'dark',
    alias: 'sl',
  },
  {
    key: 'aurora',
    label: 'Aurora',
    gradient: ['#002DA5', '#00943D'],
    textBase: 'dark',
    alias: null,
  },
  { key: 'sepia', label: 'Sepia', gradient: ['#C37811', '#8B5E0D'], textBase: 'dark', alias: null },
  {
    key: 'mint_apple',
    label: 'Mint Apple',
    gradient: ['#C8FFBF', '#EFFFBD'],
    textBase: 'light',
    alias: 'ma',
  },
  {
    key: 'citrus_sherbert',
    label: 'Citrus Sherbert',
    gradient: ['#FFEC8A', '#FFC4AA'],
    textBase: 'light',
    alias: 'cs',
  },
  {
    key: 'retro_raincloud',
    label: 'Retro Raincloud',
    gradient: ['#C0F3E9', '#F4D1C6'],
    textBase: 'light',
    alias: 'rr',
  },
  {
    key: 'hanami',
    label: 'Hanami',
    gradient: ['#F7D2D7', '#E6EFD9'],
    textBase: 'light',
    alias: null,
  },
  {
    key: 'sunrise',
    label: 'Sunrise',
    gradient: ['#D9ACA3', '#C1DDAC'],
    textBase: 'light',
    alias: 'sr',
  },
  {
    key: 'cotton_candy',
    label: 'Cotton Candy',
    gradient: ['#EEDBE2', '#B9D6F7'],
    textBase: 'light',
    alias: 'cc',
  },
  {
    key: 'lofi_vibes',
    label: 'LoFi Vibes',
    gradient: ['#C4F4DE', '#9EC5F9'],
    textBase: 'light',
    alias: 'lv',
  },
  {
    key: 'desert_khaki',
    label: 'Desert Khaki',
    gradient: ['#FCFBD1', '#F1F1EF'],
    textBase: 'light',
    alias: 'dk',
  },
] as const satisfies readonly {
  key: string
  label: string
  gradient: readonly [string, string]
  textBase: 'dark' | 'light'
  alias: string | null
}[]

export interface CataloguedColorTheme {
  key: string
  label: string
  /** `[from, to]` — the two stops of a diagonal linear gradient. */
  gradient: readonly [from: ColorInput, to: ColorInput]
  /** Which of this package's own text palettes the theme needs for contrast. */
  textBase: 'dark' | 'light'
  /** Short `theme=`-style option name, if it has one. */
  alias: string | null
}

/** Every named color theme this package knows, in the order listed above. */
export const COLOR_THEME_CATALOGUE: readonly CataloguedColorTheme[] = COLOR_THEMES

/**
 * Short option names for the catalogue above, built from `COLOR_THEMES` —
 * the same relationship `FONT_ALIASES` has to `FONT_CATALOGUE`.
 */
export const COLOR_THEME_ALIASES: Readonly<Record<string, string>> = (() => {
  const aliases: Record<string, string> = {}
  for (const entry of COLOR_THEMES) {
    if (entry.alias !== null) aliases[entry.alias] = entry.key
  }
  return aliases
})()

const KEYS_BY_NORMALIZED = new Map<string, string>(
  COLOR_THEMES.map((entry) => [normalize(entry.key), entry.key]),
)

const BY_KEY = new Map<string, CataloguedColorTheme>(
  COLOR_THEME_CATALOGUE.map((entry) => [entry.key, entry]),
)

/** Lower-cased, with underscores and spacing removed, so only the letters compare. */
function normalize(token: string): string {
  return token
    .trim()
    .toLowerCase()
    .replaceAll(/[_\s]+/g, '')
}

/**
 * Turns an alias, a full key, or a key without underscores into the
 * canonical key `colorThemeGradient()`/`colorThemeTextBase()` expect.
 *
 * ```ts
 * resolveColorTheme('mb')               // 'midnight_blurple' (alias)
 * resolveColorTheme('midnight_blurple') // 'midnight_blurple' (exact key)
 * resolveColorTheme('midnightblurple')  // 'midnight_blurple' (no underscore)
 * resolveColorTheme('MB')               // 'midnight_blurple' (case-insensitive)
 * resolveColorTheme('not-a-theme')      // undefined
 * ```
 */
export function resolveColorTheme(token: string): string | undefined {
  const key = token.trim().toLowerCase()
  if (key.length === 0) return undefined
  if (COLOR_THEME_ALIASES[key]) return COLOR_THEME_ALIASES[key]
  return KEYS_BY_NORMALIZED.get(normalize(token))
}

/**
 * The `backgroundGradient` theme value for a resolved color theme key.
 *
 * `undefined` for a key `resolveColorTheme()` did not return — pass its
 * result straight through rather than a raw user-typed token.
 */
export function colorThemeGradient(key: string): BackgroundGradientTheme | undefined {
  const theme = BY_KEY.get(key)
  if (!theme) return undefined

  return {
    type: 'linear',
    direction: 'diagonal',
    stops: [
      [theme.gradient[0], 0],
      [theme.gradient[1], 1],
    ],
  }
}

/**
 * Which text palette a resolved color theme key needs for contrast — pass
 * to `extends` as `'light'`/`'dark'`, alongside whatever `layout` you want.
 */
export function colorThemeTextBase(key: string): 'dark' | 'light' | undefined {
  return BY_KEY.get(key)?.textBase
}

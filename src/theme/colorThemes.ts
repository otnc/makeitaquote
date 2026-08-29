import { buildAliasMap, buildNormalizedKeyMap } from '../util/aliasCatalogue'
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
 *
 * See `CUSTOM_COLOR_THEMES` below for this package's own additions, kept
 * as a separate list rather than appended here.
 */
const OFFICIAL_COLOR_THEMES = [
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
] as const satisfies readonly ColorThemeRow[]

/**
 * This package's own additions, on top of `OFFICIAL_COLOR_THEMES` — kept as a
 * separate list (and separate export, `CUSTOM_COLOR_THEME_CATALOGUE`) rather
 * than merged into the catalogue above, since a Discord select menu tops out
 * at 25 options: 21 + 18 would not fit in one, so a consumer building a menu
 * needs to choose which list (or a subset) to offer rather than have that
 * decision made for them.
 *
 * Same shape and rules as `OFFICIAL_COLOR_THEMES`, but every alias here is at
 * least 4 characters — the 2-3 letter aliases above were already a tight fit
 * for 21 entries, and this list is expected to grow.
 */
const CUSTOM_COLOR_THEMES = [
  {
    key: 'tokyo_night',
    label: 'Tokyo Night',
    gradient: ['#1A1B26', '#565F89'],
    textBase: 'dark',
    alias: 'tokyo',
  },
  {
    key: 'emerald_depths',
    label: 'Emerald Depths',
    gradient: ['#012A1E', '#00B378'],
    textBase: 'dark',
    alias: 'emerald',
  },
  {
    key: 'ruby_noir',
    label: 'Ruby Noir',
    gradient: ['#2B0010', '#E0115F'],
    textBase: 'dark',
    alias: 'ruby',
  },
  {
    key: 'sapphire',
    label: 'Sapphire',
    gradient: ['#001F54', '#3A86FF'],
    textBase: 'dark',
    alias: null,
  },
  {
    key: 'golden_hour',
    label: 'Golden Hour',
    gradient: ['#3D2400', '#FFB703'],
    textBase: 'dark',
    alias: 'golden',
  },
  {
    key: 'acid_lime',
    label: 'Acid Lime',
    gradient: ['#1A2E05', '#B6FF00'],
    textBase: 'dark',
    alias: 'acid',
  },
  {
    key: 'graphite',
    label: 'Graphite',
    gradient: ['#1C1C1E', '#6E6E73'],
    textBase: 'dark',
    alias: null,
  },
  {
    key: 'volcanic_ash',
    label: 'Volcanic Ash',
    gradient: ['#1C1C1C', '#FF4500'],
    textBase: 'dark',
    alias: 'volcanic',
  },
  {
    key: 'deep_space',
    label: 'Deep Space',
    gradient: ['#00010D', '#7209B7'],
    textBase: 'dark',
    alias: 'space',
  },
  {
    key: 'ink_wash',
    label: 'Ink Wash',
    gradient: ['#05070A', '#2C3E50'],
    textBase: 'dark',
    alias: 'inkwash',
  },
  {
    key: 'mystic_teal',
    label: 'Mystic Teal',
    gradient: ['#062B2B', '#1FA2A2'],
    textBase: 'dark',
    alias: 'mystic',
  },
  {
    key: 'arctic_blue',
    label: 'Arctic Blue',
    gradient: ['#E8F6FF', '#A2D9F7'],
    textBase: 'light',
    alias: 'arctic',
  },
  {
    key: 'lavender_fields',
    label: 'Lavender Fields',
    gradient: ['#E9DFFF', '#B39DDB'],
    textBase: 'light',
    alias: 'lavender',
  },
  {
    key: 'rose_gold',
    label: 'Rose Gold',
    gradient: ['#FFE3E3', '#D9A491'],
    textBase: 'light',
    alias: 'rose',
  },
  {
    key: 'honeydew',
    label: 'Honeydew',
    gradient: ['#F2FFE9', '#C9F2C7'],
    textBase: 'light',
    alias: null,
  },
  {
    key: 'butter',
    label: 'Butter',
    gradient: ['#FFFDE7', '#FFF176'],
    textBase: 'light',
    alias: null,
  },
  {
    key: 'frostbite',
    label: 'Frostbite',
    gradient: ['#E3FDFD', '#7BE0D6'],
    textBase: 'light',
    alias: null,
  },
  {
    key: 'steel_grey',
    label: 'Steel Grey',
    gradient: ['#E4E6EB', '#A9B1BD'],
    textBase: 'light',
    alias: 'steel',
  },
] as const satisfies readonly ColorThemeRow[]

interface ColorThemeRow {
  key: string
  label: string
  gradient: readonly [string, string]
  textBase: 'dark' | 'light'
  alias: string | null
}

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

/** The named color themes this package's own presets mirror, in the order listed above. */
export const COLOR_THEME_CATALOGUE: readonly CataloguedColorTheme[] = OFFICIAL_COLOR_THEMES

/** This package's own additions — see `CUSTOM_COLOR_THEMES` above for why they're separate. */
export const CUSTOM_COLOR_THEME_CATALOGUE: readonly CataloguedColorTheme[] = CUSTOM_COLOR_THEMES

/** Both catalogues, official first — more than a Discord select menu (25 options) can hold. */
export const ALL_COLOR_THEME_CATALOGUE: readonly CataloguedColorTheme[] = [
  ...COLOR_THEME_CATALOGUE,
  ...CUSTOM_COLOR_THEME_CATALOGUE,
]

const aliasOf = (entry: ColorThemeRow) => entry.alias
const keyOf = (entry: ColorThemeRow) => entry.key

/** Short option names for `COLOR_THEME_CATALOGUE`, the same relationship `FONT_ALIASES` has to `FONT_CATALOGUE`. */
export const COLOR_THEME_ALIASES: Readonly<Record<string, string>> = buildAliasMap(
  OFFICIAL_COLOR_THEMES,
  keyOf,
  aliasOf,
)

/** Short option names for `CUSTOM_COLOR_THEME_CATALOGUE`. */
export const CUSTOM_COLOR_THEME_ALIASES: Readonly<Record<string, string>> = buildAliasMap(
  CUSTOM_COLOR_THEMES,
  keyOf,
  aliasOf,
)

/** Both alias tables merged — official first, so a name collision would favor it (there are none today). */
export const ALL_COLOR_THEME_ALIASES: Readonly<Record<string, string>> = {
  ...COLOR_THEME_ALIASES,
  ...CUSTOM_COLOR_THEME_ALIASES,
}

const ALL_COLOR_THEMES = [...OFFICIAL_COLOR_THEMES, ...CUSTOM_COLOR_THEMES]

const KEYS_BY_NORMALIZED = buildNormalizedKeyMap(ALL_COLOR_THEMES, keyOf, normalize)

const BY_KEY = new Map<string, CataloguedColorTheme>(
  ALL_COLOR_THEME_CATALOGUE.map((entry) => [entry.key, entry]),
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
  if (ALL_COLOR_THEME_ALIASES[key]) return ALL_COLOR_THEME_ALIASES[key]
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

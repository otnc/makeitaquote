import { distance } from 'fastest-levenshtein'

/**
 * Fonts this package can fetch by name, one row each — the single source
 * `FONT_CATALOGUE` and `FONT_ALIASES` are both built from. `alias` is a
 * short option name; `null` for none.
 *
 * Everything here is served by Google Fonts, which only distributes SIL
 * Open Font License, Apache 2.0 or Ubuntu Font Licence fonts — a paid or
 * otherwise-licensed font isn't on Google Fonts and can't be requested by
 * name here. The list is a convenience, not a limit: any Google Fonts
 * family works.
 */
const FONTS = [
  // Japanese
  { family: 'Noto Sans JP', alias: 'sans' },
  { family: 'M PLUS Rounded 1c', alias: 'mplus' },
  { family: 'Dela Gothic One', alias: 'dela' },
  { family: 'DotGothic16', alias: 'dot' },
  { family: 'Hachi Maru Pop', alias: 'pop' },
  { family: 'Rampart One', alias: 'rampart' },
  { family: 'Reggae One', alias: 'reggae' },
  { family: 'RocknRoll One', alias: 'rocknroll' },
  { family: 'Zen Old Mincho', alias: 'serif' },
  { family: 'Yuji Syuku', alias: 'yuji' },
  { family: 'Yusei Magic', alias: 'yusei' },
  // Latin
  { family: 'Inconsolata', alias: 'inconsolata' },
  { family: 'Exo 2', alias: 'exo2' },
  { family: 'Bruno Ace SC', alias: 'bruno' },
  { family: 'Poltawski Nowy', alias: 'poltawski' },
  { family: 'Vina Sans', alias: 'vina' },
  { family: 'Dancing Script', alias: 'script' },
  { family: 'Castoro Titling', alias: 'castoro' },
  // Script fallback only, not selectable via font= — see font/sources.ts.
  { family: 'Noto Sans SC', alias: null },
  { family: 'Nanum Gothic', alias: null },
  { family: 'IBM Plex Sans Arabic', alias: null },
] as const

export type CataloguedFont = (typeof FONTS)[number]['family']

/** Families this package can fetch by name, in the order listed above. */
export const FONT_CATALOGUE: readonly CataloguedFont[] = FONTS.map((entry) => entry.family)

/**
 * The catalogued families with no alias — installed automatically as script
 * fallback (`font/sources.ts`), but never picked by name through `font=`.
 * `miq install all --no-fallback` skips these.
 */
export const FONT_CATALOGUE_FALLBACK_ONLY: readonly CataloguedFont[] = FONTS.filter(
  (entry) => entry.alias === null,
).map((entry) => entry.family)

/**
 * CSS generic family keywords, resolved by the system rather than by name.
 * Shared with `resolveFamily()` (registry.ts) and `candidateFamilies()`
 * (render/pipeline.ts), and skipped by `resolveFontStack()` below so an
 * alias never shadows one — `FONT_ALIASES.serif` is `Zen Old Mincho`, and
 * `serif` is also this generic keyword.
 */
export const GENERIC_FONT_FAMILIES = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
])

const CATALOGUE_SET = new Set<string>(FONT_CATALOGUE)

/** Whether a family is one of the names listed above. */
export function isCatalogued(family: string): boolean {
  return CATALOGUE_SET.has(family)
}

/**
 * Short, typing-friendly names for the catalogue, built from `FONTS` above —
 * handy for exposing font choice through something like a command option.
 * Keys are lower-cased; use `resolveFontAlias()` rather than indexing this
 * directly if the input isn't already normalized.
 */
export const FONT_ALIASES: Readonly<Record<string, CataloguedFont>> = (() => {
  const aliases: Record<string, CataloguedFont> = {}
  for (const entry of FONTS) {
    if (entry.alias !== null) aliases[entry.alias] = entry.family
  }
  return aliases
})()

const CATALOGUE_BY_LOWERCASE = new Map<string, CataloguedFont>(
  FONT_CATALOGUE.map((family) => [family.toLowerCase(), family]),
)

/**
 * Turns an alias, or a catalogued family name in any case, into the exact
 * spelling `fonts.use()` expects. `undefined` for anything neither table
 * recognizes — pair with `suggestionFor()` for a "did you mean" hint.
 */
export function resolveFontAlias(input: string): string | undefined {
  const key = input.trim().toLowerCase()
  if (key.length === 0) return undefined
  return FONT_ALIASES[key] ?? CATALOGUE_BY_LOWERCASE.get(key)
}

/** `resolveFontAlias`, falling back to `input` itself when it isn't a known alias. */
export function normalizeFontFamily(input: string): string {
  return resolveFontAlias(input) ?? input
}

/** Trims a CSS font-family token and strips a matching pair of quotes, if any. */
export function unquoteFontFamily(part: string): string {
  return part.trim().replace(/^["']|["']$/g, '')
}

/**
 * Resolves every alias in a CSS-style, comma-separated font stack, so
 * `'pop, sans-serif'` and `'Hachi Maru Pop, sans-serif'` end up identical.
 * A generic keyword (`GENERIC_FONT_FAMILIES`) is left untouched even when
 * it's also an alias key; anything else unrecognized passes through as
 * typed, just trimmed and unquoted.
 */
export function resolveFontStack(stack: string): string {
  return stack
    .split(',')
    .map((part) => {
      const family = unquoteFontFamily(part)
      if (family.length === 0 || GENERIC_FONT_FAMILIES.has(family)) return family
      return normalizeFontFamily(family)
    })
    .join(', ')
}

/**
 * Names people are likely to ask for that Google Fonts does not serve.
 *
 * Kept explicit so the error can say why, rather than just "400 Bad Request".
 */
const KNOWN_UNAVAILABLE: Record<string, string> = {
  'jiyu no tsubasa': 'not distributed through Google Fonts; its licence is unclear',
}

/**
 * Near-misses the edit distance below does not catch on its own.
 *
 * Mostly rewordings rather than typos — a dropped `PLUS`, a trailing
 * `regular` — which are further from the real name than a misspelling is.
 */
const SUGGESTIONS: Record<string, string> = {
  'noto sans jp regular': 'Noto Sans JP',
  'm+ rounded 1c': 'M PLUS Rounded 1c',
}

export function unavailableReason(family: string): string | undefined {
  return KNOWN_UNAVAILABLE[family.trim().toLowerCase()]
}

/** Lowercased and stripped of spacing and punctuation, so only the letters compare. */
function normalize(family: string): string {
  return family.toLowerCase().replaceAll(/[^a-z0-9]+/g, '')
}

/**
 * How far off a name may be and still be worth suggesting.
 *
 * Proportional to length, so a long family name tolerates a couple of typos
 * while a short one does not get matched to something unrelated.
 */
function tolerance(query: string): number {
  return Math.max(2, Math.floor(query.length / 3))
}

/**
 * The catalogued family a misspelling most likely meant.
 *
 * The explicit table above wins; anything else is matched on edit distance,
 * which covers ordinary typos without having to list them one by one.
 */
export function suggestionFor(family: string): string | undefined {
  const listed = SUGGESTIONS[family.trim().toLowerCase()]
  if (listed) return listed

  const query = normalize(family)
  if (query.length === 0) return undefined

  let best: string | undefined
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of FONT_CATALOGUE) {
    const gap = distance(query, normalize(candidate))
    if (gap < bestDistance) {
      bestDistance = gap
      best = candidate
    }
  }

  return bestDistance <= tolerance(query) ? best : undefined
}

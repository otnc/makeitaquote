import { distance } from 'fastest-levenshtein'

/**
 * Fonts this package knows how to fetch by name.
 *
 * Everything here is served by Google Fonts, which only distributes fonts
 * under the SIL Open Font License, Apache 2.0 or the Ubuntu Font Licence — so
 * anything resolvable through it is free to redistribute and embed. Fonts that
 * are paid, or licensed on other terms, are not on Google Fonts and therefore
 * cannot be requested by name; `fonts.use()` rejects them rather than guessing
 * at some other download source.
 *
 * The list is a convenience, not a limit: any Google Fonts family works, and
 * `fonts.registerFromPath()` takes files from anywhere.
 */
export const FONT_CATALOGUE = [
  // Japanese
  'Noto Sans JP',
  'M PLUS Rounded 1c',
  'Dela Gothic One',
  'DotGothic16',
  'Hachi Maru Pop',
  'Rampart One',
  'Reggae One',
  'RocknRoll One',
  'Zen Old Mincho',
  'Yuji Syuku',
  'Yusei Magic',
  // Latin
  'Inconsolata',
  'Exo 2',
  'Bruno Ace SC',
  'Poltawski Nowy',
  'Vina Sans',
  'Dancing Script',
  'Castoro Titling',
] as const

export type CataloguedFont = (typeof FONT_CATALOGUE)[number]

/**
 * CSS generic family keywords — resolved by the system, never by name.
 *
 * The canonical list `resolveFamily()` (registry.ts) and `candidateFamilies()`
 * (render/pipeline.ts) both key off of, so a font stack's `sans-serif`
 * fallback is recognized the same way everywhere. Also what `resolveFontStack()`
 * below skips, so an alias never shadows one of these — `FONT_ALIASES.serif`
 * (`Zen Old Mincho`) is a real risk here, since `serif` is also this generic
 * keyword.
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
 * Short, typing-friendly names for the catalogue, matching the option names
 * the official Make it a Quote bot uses for its own `font=` choices.
 *
 * A convenience for consumers exposing font choice through something like a
 * Discord slash command option, so they don't each have to hand-roll the same
 * mapping. Keys are lower-cased; look them up through `resolveFontAlias()`
 * rather than indexing this object directly if the input isn't already
 * normalized.
 */
export const FONT_ALIASES: Record<string, CataloguedFont> = {
  mplus: 'M PLUS Rounded 1c',
  dela: 'Dela Gothic One',
  dot: 'DotGothic16',
  pop: 'Hachi Maru Pop',
  rampart: 'Rampart One',
  reggae: 'Reggae One',
  rocknroll: 'RocknRoll One',
  serif: 'Zen Old Mincho',
  yuji: 'Yuji Syuku',
  yusei: 'Yusei Magic',
  inconsolata: 'Inconsolata',
  exo2: 'Exo 2',
  bruno: 'Bruno Ace SC',
  poltawski: 'Poltawski Nowy',
  vina: 'Vina Sans',
  script: 'Dancing Script',
  castoro: 'Castoro Titling',
}

const CATALOGUE_BY_LOWERCASE = new Map<string, CataloguedFont>(
  FONT_CATALOGUE.map((family) => [family.toLowerCase(), family]),
)

/**
 * Turns whatever a caller typed — an alias, or a catalogued family name in
 * any case — into the exact spelling `fonts.use()` expects.
 *
 * Meant for a case like a Discord `font=` option: the input could be a short
 * alias, the real name typed in any case, or neither. Aliases are checked
 * first, though the two tables don't actually collide today.
 *
 * Returns `undefined` for anything neither table recognizes — pair with
 * `suggestionFor()` if the caller wants a "did you mean" hint for that case.
 */
export function resolveFontAlias(input: string): string | undefined {
  const key = input.trim().toLowerCase()
  if (key.length === 0) return undefined
  return FONT_ALIASES[key] ?? CATALOGUE_BY_LOWERCASE.get(key)
}

/**
 * Resolves every alias in a CSS-style, comma-separated font stack to its real
 * family name — so `'pop, sans-serif'` and `'Hachi Maru Pop, sans-serif'` end
 * up identical wherever a font is set (`theme.text.font`, `fonts.use()`, the
 * CLI). A generic keyword (`GENERIC_FONT_FAMILIES`) is left untouched even
 * when it also happens to be an alias key (`serif`), and anything neither
 * table recognizes — an arbitrary Google Fonts family, a font registered by
 * hand — passes through as typed, just trimmed and unquoted.
 */
export function resolveFontStack(stack: string): string {
  return stack
    .split(',')
    .map((part) => {
      const family = part.trim().replace(/^["']|["']$/g, '')
      if (family.length === 0 || GENERIC_FONT_FAMILIES.has(family)) return family
      return resolveFontAlias(family) ?? family
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

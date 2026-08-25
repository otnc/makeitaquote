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

const CATALOGUE_SET = new Set<string>(FONT_CATALOGUE)

/** Whether a family is one of the names listed above. */
export function isCatalogued(family: string): boolean {
  return CATALOGUE_SET.has(family)
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

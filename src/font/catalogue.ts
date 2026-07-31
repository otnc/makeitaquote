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
  'castor titling': 'not distributed through Google Fonts',
}

/** Common typos, so a near-miss gets a useful suggestion. */
const SUGGESTIONS: Record<string, string> = {
  'dacing script': 'Dancing Script',
  'noto sans jp regular': 'Noto Sans JP',
  'mplus rounded 1c': 'M PLUS Rounded 1c',
  'm+ rounded 1c': 'M PLUS Rounded 1c',
  'dot gothic 16': 'DotGothic16',
  'rock n roll one': 'RocknRoll One',
  exo2: 'Exo 2',
}

export function unavailableReason(family: string): string | undefined {
  return KNOWN_UNAVAILABLE[family.trim().toLowerCase()]
}

export function suggestionFor(family: string): string | undefined {
  return SUGGESTIONS[family.trim().toLowerCase()]
}

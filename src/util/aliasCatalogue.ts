/**
 * Shared shape behind `font/catalogue.ts`'s `FONTS` and `theme/colorThemes.ts`'s `OFFICIAL_COLOR_THEMES`/`CUSTOM_COLOR_THEMES`: a fixed list of named rows, each with an optional short alias, that needs both an alias -> key lookup and a "the key itself, tolerant of case/formatting" lookup.
 */

/** Alias → canonical key, for rows that have a short option name. */
export function buildAliasMap<Row, T extends string>(
  rows: readonly Row[],
  getKey: (row: Row) => T,
  getAlias: (row: Row) => string | null,
): Readonly<Record<string, T>> {
  const aliases: Record<string, T> = {}
  for (const row of rows) {
    const alias = getAlias(row)
    if (alias !== null) aliases[alias] = getKey(row)
  }
  return aliases
}

/**
 * Every row's own key, keyed by `normalize(key)` — the "exact name" half of a resolver, alongside `buildAliasMap`'s "short name" half.
 */
export function buildNormalizedKeyMap<Row, T extends string>(
  rows: readonly Row[],
  getKey: (row: Row) => T,
  normalize: (token: string) => string,
): Map<string, T> {
  return new Map(rows.map((row) => [normalize(getKey(row)), getKey(row)]))
}

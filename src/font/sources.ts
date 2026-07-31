/**
 * Families fetched automatically when nothing on the system can draw the text.
 *
 * M PLUS Rounded 1c is the house font — a rounded gothic that suits the format
 * and covers Latin as well as Japanese. Noto Sans JP sits behind it as the
 * safety net: it has the wider coverage of the two, so anything the rounded
 * face is missing still lands on a real glyph rather than a box.
 *
 * Change it with `autoFont: { families: [...] }`.
 */
export const DEFAULT_FONT_FAMILIES = ['M PLUS Rounded 1c', 'Noto Sans JP']

/** The family every theme falls back to, resolved by the system. */
export const FALLBACK_FAMILY = 'sans-serif'

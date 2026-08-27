import type { CataloguedFont } from './catalogue'

/**
 * Families fetched automatically when nothing on the system can draw the text.
 *
 * M PLUS Rounded 1c is the house font — a rounded gothic that suits the format
 * and covers Latin as well as Japanese. Noto Sans JP sits behind it as the
 * general CJK safety net: it has the wider coverage of the two, so anything
 * the rounded face is missing still lands on a real glyph rather than a box.
 *
 * The rest cover scripts neither of those two do: Nanum Gothic (Korean),
 * Noto Sans SC (Simplified Chinese) and IBM Plex Sans Arabic (Arabic) — the
 * matching official-bot fallbacks Google Fonts actually serves (see #59;
 * Traditional Chinese and the rarer scripts the official bot also falls back
 * to are not on Google Fonts, so this package has no source for them — same
 * reasoning as #44).
 *
 * Every family here is fetched whenever *any* fallback-needing script shows
 * up (`needsGlyphFallback()`, render/glyphs.ts) — not just its own — since
 * Unicode's script property cannot tell Simplified Chinese text apart from
 * Japanese Kanji, so there is no cheaper way to gate Noto Sans SC alone.
 * Widening this list trades a larger default download for fewer scripts
 * rendering as tofu out of the box.
 *
 * Typed against `CataloguedFont` so a rename in `FONT_CATALOGUE` breaks this
 * at compile time instead of silently falling out of sync with it.
 *
 * Change it with `autoFont: { families: [...] }`.
 */
export const DEFAULT_FONT_FAMILIES: readonly CataloguedFont[] = [
  'M PLUS Rounded 1c',
  'Noto Sans JP',
  'Nanum Gothic',
  'Noto Sans SC',
  'IBM Plex Sans Arabic',
]

/** The family every theme falls back to, resolved by the system. */
export const FALLBACK_FAMILY = 'sans-serif'

import type { CataloguedFont } from './catalogue'

/**
 * Families fetched automatically when nothing on the system can draw the
 * text. M PLUS Rounded 1c is the house font; Noto Sans JP behind it is the
 * general CJK safety net. Nanum Gothic, Noto Sans SC and IBM Plex Sans
 * Arabic cover Korean, Simplified Chinese and Arabic respectively.
 *
 * All five are fetched whenever *any* fallback-needing script shows up
 * (`needsGlyphFallback()`, render/glyphs.ts), not just its own — Unicode's
 * script property can't tell Simplified Chinese apart from Japanese Kanji,
 * so there's no cheaper way to gate Noto Sans SC alone.
 *
 * Typed against `CataloguedFont` so a rename in `FONT_CATALOGUE` breaks this
 * at compile time. Change it with `autoFont: { families: [...] }`.
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

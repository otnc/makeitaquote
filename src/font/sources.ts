import type { CataloguedFont } from './catalogue'

/**
 * Families fetched automatically when nothing on the system can draw the
 * text. M PLUS Rounded 1c is the house font; Noto Sans JP behind it is the
 * general CJK safety net. Nanum Gothic, Chiron GoRound TC, Noto Sans SC and
 * IBM Plex Sans Arabic cover Korean, Traditional Chinese, Simplified Chinese
 * and Arabic respectively — Chiron GoRound TC sits ahead of Noto Sans SC so a
 * character both can draw still comes out in traditional-style forms rather
 * than simplified ones.
 *
 * All six are fetched whenever *any* fallback-needing script shows up
 * (`needsGlyphFallback()`, render/glyphs.ts), not just its own — Unicode's
 * script property can't tell Chinese variants apart from each other or from
 * Japanese Kanji, so there's no cheaper way to gate one of them alone.
 *
 * Typed against `CataloguedFont` so a rename in `FONT_CATALOGUE` breaks this
 * at compile time. Change it with `autoFont: { families: [...] }`.
 */
export const DEFAULT_FONT_FAMILIES: readonly CataloguedFont[] = [
  'M PLUS Rounded 1c',
  'Noto Sans JP',
  'Nanum Gothic',
  'Chiron GoRound TC',
  'Noto Sans SC',
  'IBM Plex Sans Arabic',
]

/** The family every theme falls back to, resolved by the system. */
export const FALLBACK_FAMILY = 'sans-serif'

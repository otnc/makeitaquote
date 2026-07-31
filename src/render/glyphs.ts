import { resolveFamily } from '../font/registry'
import { FALLBACK_FAMILY } from '../font/sources'

/**
 * Scripts that a display font is likely not to cover.
 *
 * Latin is absent on purpose: everything has it, so it never changes what we
 * do.
 */
const NEEDS_FALLBACK =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Thai}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}]/u

/** Whether text contains anything a Latin-only font would fail to draw. */
export function needsGlyphFallback(text: string): boolean {
  return NEEDS_FALLBACK.test(text)
}

/**
 * A font stack that can draw `text`.
 *
 * The requested family stays in front and the fallbacks go behind it. Skia
 * resolves a stack per glyph, so the chosen font is still used for everything
 * it has — measured on Vina Sans (Latin only) with Noto Sans JP behind it,
 * `A` keeps Vina's width and `猫` takes Noto's.
 *
 * No attempt is made to detect whether the primary "covers" a script: a font
 * missing a glyph does not reliably measure as tofu, so a probe based on width
 * gets it wrong. Naming the fallbacks unconditionally costs nothing when they
 * are not needed and is right when they are.
 */
export function coveringStack(request: string, text: string, fallbacks: readonly string[]): string {
  const primary = resolveFamily(request) ?? FALLBACK_FAMILY
  if (!needsGlyphFallback(text)) return primary

  const stack = [primary]
  for (const family of fallbacks) {
    // Only families already registered — this is a rendering decision, not a
    // reason to reach for the network.
    const resolved = resolveFamily(family)
    if (resolved && !stack.includes(resolved)) stack.push(resolved)
  }

  if (!stack.includes(FALLBACK_FAMILY)) stack.push(FALLBACK_FAMILY)
  return stack.join(', ')
}

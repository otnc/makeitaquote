const segmenters = new Map<string, Intl.Segmenter>()

function segmenterFor(locale: string): Intl.Segmenter {
  let segmenter = segmenters.get(locale)
  if (!segmenter) {
    segmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' })
    segmenters.set(locale, segmenter)
  }
  return segmenter
}

/**
 * Splits text into user-perceived characters.
 *
 * Breaking a line anywhere else would tear a surrogate pair, a combining mark or a ZWJ emoji sequence in half.
 */
export function graphemes(text: string, locale = 'ja'): string[] {
  const out: string[] = []
  for (const { segment } of segmenterFor(locale).segment(text)) out.push(segment)
  return out
}

/**
 * Indices at which a grapheme starts, plus `text.length`.
 *
 * Every legal break position is one of these.
 */
export function graphemeBoundaries(text: string, locale = 'ja'): number[] {
  const out: number[] = []
  for (const { index } of segmenterFor(locale).segment(text)) out.push(index)
  out.push(text.length)
  return out
}

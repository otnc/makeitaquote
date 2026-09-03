import type { EmojiMetrics, TextMeasurer } from '../text/measure'

/**
 * A measurer with no fonts involved: ASCII is one unit wide, everything else two. Close enough to the half-width/full-width split that wrapping tests read like the output they assert on.
 */
export function fakeMeasurer(unit = 10): TextMeasurer {
  return {
    measureText(text: string) {
      let width = 0
      // Iterating a string yields whole code points, so this is never empty.
      for (const char of text) width += (char.codePointAt(0) ?? 0) < 0x80 ? unit : unit * 2
      return { width }
    },
  }
}

export function fakeMetrics(fontSize = 20, sideMarginRatio = 0): EmojiMetrics {
  return { fontSize, sideMarginRatio }
}

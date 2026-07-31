import type { Segment } from '../core/types'

/**
 * The slice of the canvas context that measurement needs.
 *
 * Narrow on purpose: tests inject a fake with predictable widths instead of
 * standing up a real canvas and depending on whatever fonts the machine has.
 */
export interface TextMeasurer {
  measureText(text: string): { width: number }
}

/** What to do with an emoji whose image could not be fetched. */
export type MissingEmojiBehaviour = 'ignore' | 'text' | 'throw'

export interface EmojiMetrics {
  /** Emoji are drawn as a square of the font size. */
  fontSize: number
  /** Padding either side, as a fraction of the font size. */
  sideMarginRatio: number
}

/** Total advance width of an emoji image, including its side margins. */
export function emojiWidth(metrics: EmojiMetrics): number {
  return metrics.fontSize * (1 + metrics.sideMarginRatio * 2)
}

/**
 * How wide a segment will be drawn.
 *
 * Every emoji reaching this point has an image — ones that failed are turned
 * into text segments before layout starts, by `resolveEmojiSegments`, so that
 * measurement and drawing can never disagree about their width.
 */
export function segmentWidth(
  segment: Segment,
  measurer: TextMeasurer,
  metrics: EmojiMetrics,
): number {
  return segment.kind === 'text' ? measurer.measureText(segment.value).width : emojiWidth(metrics)
}

export function measureSegments(
  segments: readonly Segment[],
  measurer: TextMeasurer,
  metrics: EmojiMetrics,
): number {
  let width = 0
  for (const segment of segments) width += segmentWidth(segment, measurer, metrics)
  return width
}

/**
 * Memoizes `measureText`, which dominates the cost of the auto-fit search:
 * the same substrings are measured over and over as the font size steps down.
 *
 * The cache is keyed by string alone, so a new one is needed whenever the font
 * or size on the context changes.
 */
export function memoizeMeasurer(measurer: TextMeasurer): TextMeasurer {
  const cache = new Map<string, number>()
  return {
    measureText(text: string) {
      const cached = cache.get(text)
      if (cached !== undefined) return { width: cached }
      const { width } = measurer.measureText(text)
      cache.set(text, width)
      return { width }
    },
  }
}

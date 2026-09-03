import { RenderError } from '../core/errors'
import type { Segment } from '../core/types'
import type { TextOverflow } from '../theme/types'
import { graphemes } from '../util/grapheme'
import type { BreakpointOptions } from './breakpoint'
import { type EmojiMetrics, measureSegments, type TextMeasurer } from './measure'
import { type Line, lineToString, wrapSegments } from './wrap'

export interface FitOptions extends BreakpointOptions {
  maxWidth: number
  maxHeight: number
  /** Largest font size to try, in pixels. */
  maxFontSize: number
  /** Smallest font size to try, in pixels. */
  minFontSize: number
  lineHeight: number
  /** Hard cap on line count, independent of `maxHeight`. `undefined`: no cap. */
  maxLines?: number
  overflow: TextOverflow
  /** Built for a given font size; the search re-asks for one per step. */
  measurerFor: (fontSize: number) => TextMeasurer
  metricsFor: (fontSize: number) => EmojiMetrics
  /** Step between candidate sizes, in pixels. Default 1. */
  step?: number
}

export interface FitResult {
  lines: Line[]
  fontSize: number
  /** True when the text had to be truncated to fit. */
  truncated: boolean
}

/**
 * Finds the largest font size at which the quote fits its box.
 *
 * Steps down linearly rather than binary searching: kinsoku rules mean a smaller size can occasionally need *more* lines, so "fits" is not perfectly monotonic and a binary search can settle on the wrong side of a boundary. With measurement memoized this is a handful of microseconds either way.
 *
 * Before doing a full wrap at each size, `mayFit` checks a cheap lower bound: no wrapping algorithm can pack the segments' total width into fewer lines than `total / maxWidth`, so once even that best case already exceeds the line budget, the real wrap is guaranteed to fail too and can be skipped. This never changes which font size wins — it only skips sizes that were always going to fail — so it's safe alongside the non-monotonicity above.
 */
export function fitText(segments: readonly Segment[], options: FitOptions): FitResult {
  const step = options.step ?? 1
  const min = Math.max(1, Math.floor(options.minFontSize))
  const max = Math.max(min, Math.floor(options.maxFontSize))

  let smallest: { lines: Line[]; fontSize: number } | null = null

  for (let fontSize = max; fontSize >= min; fontSize -= step) {
    const measurer = options.measurerFor(fontSize)
    const metrics = options.metricsFor(fontSize)

    // The last candidate must always be fully computed: if nothing fits,
    // `smallest` needs real lines from it for the shrink/truncate fallback.
    const isLastCandidate = fontSize - step < min
    if (!isLastCandidate && !mayFit(segments, measurer, metrics, fontSize, options)) continue

    const lines = wrapAt(segments, measurer, metrics, options)
    if (fits(lines, fontSize, options)) {
      return { lines, fontSize, truncated: false }
    }
    smallest = { lines, fontSize }
  }

  if (!smallest) {
    const measurer = options.measurerFor(min)
    const metrics = options.metricsFor(min)
    const lines = wrapAt(segments, measurer, metrics, options)
    smallest = { lines, fontSize: min }
  }

  if (options.overflow === 'error') {
    throw new RenderError(
      `Text does not fit: it needs ${smallest.lines.length} lines at the minimum font size ` +
        `of ${smallest.fontSize}px, but only ${maxLines(smallest.fontSize, options)} fit.`,
    )
  }

  if (options.overflow === 'shrink') {
    return { lines: smallest.lines, fontSize: smallest.fontSize, truncated: false }
  }

  return {
    lines: truncate(smallest.lines, smallest.fontSize, options),
    fontSize: smallest.fontSize,
    truncated: true,
  }
}

function wrapAt(
  segments: readonly Segment[],
  measurer: TextMeasurer,
  metrics: EmojiMetrics,
  options: FitOptions,
): Line[] {
  return wrapSegments(segments, {
    maxWidth: options.maxWidth,
    measurer,
    metrics,
    ...(options.phraseBreak === undefined ? {} : { phraseBreak: options.phraseBreak }),
    ...(options.locale === undefined ? {} : { locale: options.locale }),
  })
}

/**
 * A lower bound on the lines `wrapAt` could possibly need: no wrapping algorithm can fit more than `maxWidth` of content per line, so packing the segments' total width that tightly is the best case. Kinsoku, forced breaks and word boundaries can only need as many or more lines than this, never fewer.
 */
function mayFit(
  segments: readonly Segment[],
  measurer: TextMeasurer,
  metrics: EmojiMetrics,
  fontSize: number,
  options: FitOptions,
): boolean {
  const totalWidth = measureSegments(segments, measurer, metrics)
  const bestCaseLines = Math.max(1, Math.ceil(totalWidth / options.maxWidth))
  return bestCaseLines <= maxLines(fontSize, options)
}

function maxLines(fontSize: number, options: FitOptions): number {
  const geometric = Math.max(1, Math.floor(options.maxHeight / (fontSize * options.lineHeight)))
  return options.maxLines === undefined ? geometric : Math.min(geometric, options.maxLines)
}

function fits(lines: Line[], fontSize: number, options: FitOptions): boolean {
  return lines.length <= maxLines(fontSize, options)
}

/**
 * Cuts the text down to the lines that fit and marks the cut with an ellipsis.
 *
 * The ellipsis replaces trailing characters rather than being appended, so the last line still fits.
 */
function truncate(lines: Line[], fontSize: number, options: FitOptions): Line[] {
  const limit = maxLines(fontSize, options)
  if (lines.length <= limit) return lines

  const kept = lines.slice(0, limit)
  const last = kept[kept.length - 1]
  if (!last) return kept

  const measurer = options.measurerFor(fontSize)
  const emojiSize = options.metricsFor(fontSize).fontSize
  const ellipsis = '…'
  const ellipsisWidth = measurer.measureText(ellipsis).width

  // Track width incrementally to avoid re-measuring all segments each iteration.
  const trimmed = [...last]
  const widths: number[] = []
  let width = 0
  for (const segment of trimmed) {
    const w = segment.kind === 'text' ? measurer.measureText(segment.value).width : emojiSize
    widths.push(w)
    width += w
  }

  while (trimmed.length > 0) {
    if (width + ellipsisWidth <= options.maxWidth) break

    const tail = trimmed[trimmed.length - 1]
    if (tail?.kind === 'text') {
      const clusters = graphemes(tail.value, options.locale === 'none' ? 'ja' : options.locale)
      if (clusters.length > 1) {
        clusters.pop()
        const newValue = clusters.join('')
        const newWidth = measurer.measureText(newValue).width
        width += newWidth - widths[widths.length - 1]
        widths[widths.length - 1] = newWidth
        trimmed[trimmed.length - 1] = { kind: 'text', value: newValue }
        continue
      }
    }

    const removed = widths.pop()
    if (removed !== undefined) width -= removed
    trimmed.pop()
  }

  const tail = trimmed[trimmed.length - 1]
  if (tail?.kind === 'text') {
    trimmed[trimmed.length - 1] = { kind: 'text', value: tail.value + ellipsis }
  } else {
    trimmed.push({ kind: 'text', value: ellipsis })
  }

  kept[kept.length - 1] = trimmed
  return kept
}

/** The wrapped text as plain strings, one per line. */
export function linesToStrings(lines: readonly Line[]): string[] {
  return lines.map(lineToString)
}

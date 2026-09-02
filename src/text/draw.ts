import type { EmojiImages } from '../emoji/loader'
import type { Image, SKRSContext2D } from '../render/canvasFactory'
import { boldAdvance, fillText } from '../render/textStyle'
import { emojiWidth, type MissingEmojiBehaviour } from './measure'
import type { Line } from './wrap'

export interface DrawLineOptions {
  fontSize: number
  sideMarginRatio: number
  topMarginRatio: number
  images: EmojiImages
  /** What to do with an emoji whose image is missing. */
  onMissing: MissingEmojiBehaviour
  /** Stroke width used to fake bold, from `syntheticBoldWidth`. */
  boldStroke?: number
}

/**
 * Each segment's drawn width. Call once per line and pass the result to both
 * `drawnLineWidth()` (for alignment, before drawing) and `drawLine()` (to
 * avoid re-measuring every segment a second time) — `drawLine` still accepts
 * no `widths` and measures its own if the caller only needs to draw.
 *
 * Includes `boldAdvance()` for text, since a synthetic-bold stroke widens
 * what's painted beyond what `measureText` reports. A missing emoji drawn as
 * its raw fallback text (`onMissing: 'text'`) is measured as that actual
 * text, not a generic emoji-square width; `onMissing: 'ignore'` draws and
 * advances nothing.
 */
export function measureLine(ctx: SKRSContext2D, line: Line, options: DrawLineOptions): number[] {
  const stroke = options.boldStroke ?? 0
  return line.map((segment) => {
    if (segment.kind === 'text') return ctx.measureText(segment.value).width + boldAdvance(stroke)
    if (options.images.get(segment.url)) return emojiWidth(options)
    if (options.onMissing === 'text')
      return ctx.measureText(segment.raw).width + boldAdvance(stroke)
    return 0
  })
}

/** Width of a line as it will actually be drawn. */
export function drawnLineWidth(ctx: SKRSContext2D, line: Line, options: DrawLineOptions): number {
  return measureLine(ctx, line, options).reduce((total, width) => total + width, 0)
}

/**
 * Draws one wrapped line, with `x` at its left edge and `y` on the baseline.
 *
 * Emoji are drawn as squares of the font size, sitting on the baseline the
 * same way a glyph would. `widths` is `measureLine()`'s result for this same
 * line — pass the one the caller already computed for `alignedX()` rather
 * than measuring every segment over again; omit it to measure here instead.
 */
export function drawLine(
  ctx: SKRSContext2D,
  line: Line,
  x: number,
  y: number,
  options: DrawLineOptions,
  widths: readonly number[] = measureLine(ctx, line, options),
): void {
  const { fontSize } = options
  const sideMargin = fontSize * options.sideMarginRatio
  const topMargin = fontSize * options.topMarginRatio
  const stroke = options.boldStroke ?? 0

  let cursor = x
  line.forEach((segment, i) => {
    if (segment.kind === 'text') {
      fillText(ctx, segment.value, cursor, y, stroke)
    } else {
      const image = options.images.get(segment.url)
      if (image) {
        drawEmoji(ctx, image, cursor + sideMargin, y - fontSize + topMargin, fontSize)
      } else if (options.onMissing === 'text') {
        // Better to show `<:blobcat:123…>` than a gap where an emoji should be.
        fillText(ctx, segment.raw, cursor, y, stroke)
      }
    }
    cursor += widths[i] as number
  })
}

function drawEmoji(ctx: SKRSContext2D, image: Image, x: number, y: number, size: number): void {
  ctx.drawImage(image, x, y, size, size)
}

/** Left edge for a line of the given width within a box. */
export function alignedX(
  align: 'left' | 'center' | 'right',
  boxX: number,
  boxWidth: number,
  lineWidth: number,
): number {
  if (align === 'center') return boxX + (boxWidth - lineWidth) / 2
  if (align === 'right') return boxX + boxWidth - lineWidth
  return boxX
}

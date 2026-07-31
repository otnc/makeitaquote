import type { EmojiImages } from '../emoji/loader'
import type { Image, SKRSContext2D } from '../render/canvasFactory'
import { fillText } from '../render/textStyle'
import { emojiWidth, type MissingEmojiBehaviour, segmentWidth } from './measure'
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
 * Width of a line as it will actually be drawn.
 *
 * Deliberately the same `segmentWidth` the wrapper used, so a line can never
 * be laid out at one width and drawn at another.
 */
export function drawnLineWidth(ctx: SKRSContext2D, line: Line, options: DrawLineOptions): number {
  let width = 0
  for (const segment of line) {
    width += segmentWidth(segment, ctx, options)
  }
  return width
}

/**
 * Draws one wrapped line, with `x` at its left edge and `y` on the baseline.
 *
 * Emoji are drawn as squares of the font size, sitting on the baseline the
 * same way a glyph would.
 */
export function drawLine(
  ctx: SKRSContext2D,
  line: Line,
  x: number,
  y: number,
  options: DrawLineOptions,
): void {
  const { fontSize } = options
  const sideMargin = fontSize * options.sideMarginRatio
  const topMargin = fontSize * options.topMarginRatio
  let cursor = x

  const stroke = options.boldStroke ?? 0

  for (const segment of line) {
    if (segment.kind === 'text') {
      fillText(ctx, segment.value, cursor, y, stroke)
      cursor += ctx.measureText(segment.value).width
      continue
    }

    const image = options.images.get(segment.url)
    if (image) {
      drawEmoji(ctx, image, cursor + sideMargin, y - fontSize + topMargin, fontSize)
      cursor += emojiWidth(options)
    } else if (options.onMissing === 'text') {
      // Better to show `<:blobcat:123…>` than a gap where an emoji should be.
      fillText(ctx, segment.raw, cursor, y, stroke)
      cursor += ctx.measureText(segment.raw).width
    }
  }
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

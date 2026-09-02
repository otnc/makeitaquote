import type { TextStyle } from '../core/types'
import type { EmojiImages } from '../emoji/loader'
import type { Image, SKRSContext2D } from '../render/canvasFactory'
import { fontString } from '../render/layout'
import { boldAdvance, fillText, resolvedWeight, syntheticBoldWidth } from '../render/textStyle'
import type { FontWeight } from '../theme/types'
import { emojiWidth, type MissingEmojiBehaviour } from './measure'
import type { Line } from './wrap'

export interface DrawLineOptions {
  fontSize: number
  sideMarginRatio: number
  topMarginRatio: number
  images: EmojiImages
  /** What to do with an emoji whose image is missing. */
  onMissing: MissingEmojiBehaviour
  /** The theme's own weight for this text, before any markdown-requested bold. */
  baseWeight: FontWeight
  /** Resolved font family stack, already picked for glyph coverage. */
  family: string
}

/**
 * Sets `ctx.font` for a run in the given style and returns the
 * synthetic-bold stroke width to draw it with, via `syntheticBoldWidth()`
 * (`0` when none is needed).
 *
 * Shared by `drawnLineWidth()` and `drawLine()`, and used with `style:
 * undefined` for the plain fallback text of a missing emoji, so a line is
 * never measured with one font and drawn with another.
 */
function applyFont(
  ctx: SKRSContext2D,
  style: TextStyle | undefined,
  options: DrawLineOptions,
): number {
  const weight = resolvedWeight(options.baseWeight, style?.bold)
  ctx.font = fontString(weight, options.fontSize, options.family, style?.italic ?? false)
  return syntheticBoldWidth(ctx, weight, options.family, options.fontSize)
}

/**
 * Each segment's drawn width. Call once per line and pass the result to both
 * `drawnLineWidth()` (for alignment, before drawing) and `drawLine()` (to
 * avoid re-measuring every segment a second time) — `drawLine` still accepts
 * no `widths` and measures its own if the caller only needs to draw.
 *
 * Deliberately resolves font/stroke the same way `drawLine()` does for each
 * segment, so a line can never be laid out at one width and drawn at another.
 * A missing emoji drawn as its raw fallback text (`onMissing: 'text'`) is
 * measured as that actual text, not a generic emoji-square width;
 * `onMissing: 'ignore'` draws and advances nothing.
 */
export function measureLine(ctx: SKRSContext2D, line: Line, options: DrawLineOptions): number[] {
  return line.map((segment) => {
    if (segment.kind === 'text') {
      const stroke = applyFont(ctx, segment.style, options)
      return ctx.measureText(segment.value).width + boldAdvance(stroke)
    }
    if (options.images.get(segment.url)) return emojiWidth(options)
    if (options.onMissing === 'text') {
      const stroke = applyFont(ctx, undefined, options)
      return ctx.measureText(segment.raw).width + boldAdvance(stroke)
    }
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
  let cursor = x

  line.forEach((segment, i) => {
    if (segment.kind === 'text') {
      const stroke = applyFont(ctx, segment.style, options)
      fillText(ctx, segment.value, cursor, y, stroke)
      // The plain (unstroked) width, for the decoration bands below —
      // widths[i] already includes boldAdvance(stroke) on top of it.
      const width = (widths[i] as number) - boldAdvance(stroke)
      if (segment.style?.underline) drawDecoration(ctx, cursor, y, width, fontSize, 'underline')
      if (segment.style?.strikethrough) {
        drawDecoration(ctx, cursor, y, width, fontSize, 'strikethrough')
      }
    } else {
      const image = options.images.get(segment.url)
      if (image) {
        drawEmoji(ctx, image, cursor + sideMargin, y - fontSize + topMargin, fontSize)
      } else if (options.onMissing === 'text') {
        // Better to show `<:blobcat:123…>` than a gap where an emoji should be.
        // Unstyled: this is fallback text, not the markdown source's own run.
        const stroke = applyFont(ctx, undefined, options)
        fillText(ctx, segment.raw, cursor, y, stroke)
      }
    }
    cursor += widths[i] as number
  })
}

/**
 * Draws an underline or strikethrough band under/through a run.
 *
 * A filled rectangle in the already-set `fillStyle` rather than a stroked
 * line: `strokeText`'s stroke state is already in play for synthetic bold
 * (see `fillText()`'s own comment on this canvas build not restoring
 * `strokeStyle`), so this avoids touching stroke state at all.
 */
function drawDecoration(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  kind: 'underline' | 'strikethrough',
): void {
  const thickness = Math.max(1, fontSize * 0.06)
  const offset = kind === 'underline' ? fontSize * 0.08 : -fontSize * 0.32
  ctx.fillRect(x, y + offset, width, thickness)
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

import type { FontWeight } from '../theme/types'
import type { SKRSContext2D } from './canvasFactory'

/** Mixed script, so the probe catches fonts that only vary in one of them. */
const PROBE = 'AWMil あ漢'

/** Whether a weight asks for something heavier than regular. */
export function isBold(weight: FontWeight): boolean {
  if (typeof weight === 'number') return weight >= 600
  return weight === 'bold' || weight === 'bolder'
}

/**
 * Families whose bold is faked, keyed by family name.
 *
 * Variable fonts registered through `GlobalFonts` — including the Noto Sans JP
 * this package downloads — expose only their default instance to Skia, so
 * `ctx.font = 'bold …'` measures and draws identically to regular. Detected
 * once per family by measuring both.
 */
const syntheticFamilies = new Map<string, boolean>()

function detect(ctx: SKRSContext2D, family: string): boolean {
  const cached = syntheticFamilies.get(family)
  if (cached !== undefined) return cached

  const previous = ctx.font
  ctx.font = `100px ${family}`
  const regular = ctx.measureText(PROBE).width
  ctx.font = `bold 100px ${family}`
  const bold = ctx.measureText(PROBE).width
  ctx.font = previous

  // A real bold face is wider. Anything within a rounding error of regular
  // means the weight was ignored.
  const synthetic = regular > 0 && bold <= regular * 1.001
  syntheticFamilies.set(family, synthetic)
  return synthetic
}

/**
 * How wide to stroke text to fake bold, in pixels. `0` means don't.
 *
 * Stroking the glyph outline in the fill color thickens it, which is the
 * standard way to emulate bold on a canvas when no bold face is available.
 */
export function syntheticBoldWidth(
  ctx: SKRSContext2D,
  weight: FontWeight,
  family: string,
  fontSize: number,
): number {
  if (!isBold(weight)) return 0
  if (!detect(ctx, family)) return 0

  const heaviness = typeof weight === 'number' ? Math.min(1, (weight - 500) / 400) : 0.75
  return fontSize * 0.045 * heaviness
}

/**
 * Fills text, thickening it first if bold has to be faked.
 *
 * `strokeWidth` comes from `syntheticBoldWidth`; passing 0 makes this a plain
 * `fillText`.
 */
export function fillText(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  strokeWidth: number,
): void {
  if (strokeWidth > 0) {
    // Restoring by hand rather than with save()/restore(): this build of the
    // canvas does not put strokeStyle back.
    const previousStroke = ctx.strokeStyle
    const previousWidth = ctx.lineWidth
    const previousJoin = ctx.lineJoin

    ctx.strokeStyle = ctx.fillStyle
    ctx.lineWidth = strokeWidth
    ctx.lineJoin = 'round'
    ctx.strokeText(text, x, y)

    ctx.strokeStyle = previousStroke
    ctx.lineWidth = previousWidth
    ctx.lineJoin = previousJoin
  }
  ctx.fillText(text, x, y)
}

/** Extra advance width a synthetic bold stroke adds to a run of text. */
export function boldAdvance(strokeWidth: number): number {
  return strokeWidth > 0 ? strokeWidth : 0
}

/** Test seam: forces bold detection to run again. */
export function resetBoldDetectionForTests(): void {
  syntheticFamilies.clear()
}

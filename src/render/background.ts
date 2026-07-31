import { parseColor, toCSS, withAlpha } from '../theme/color'
import type { Theme } from '../theme/types'
import type { SKRSContext2D } from './canvasFactory'
import { gradientLine } from './layout'

export function drawBackground(ctx: SKRSContext2D, theme: Theme): void {
  const background = parseColor(theme.background, 'theme.background')
  if (background.a <= 0) return

  ctx.fillStyle = toCSS(background)
  ctx.fillRect(0, 0, theme.width, theme.height)
}

/**
 * Fades the avatar into the background.
 *
 * Runs sideways for the `side` layout and downwards for `stacked`; the
 * horizontal one is mirrored when the avatar is on the right.
 */
export function drawGradient(ctx: SKRSContext2D, theme: Theme): void {
  if (!theme.gradient.enabled) return

  const background = parseColor(theme.background, 'theme.background')
  // Fading into a transparent background would only make the avatar vanish,
  // which is not what a gradient is for.
  if (background.a <= 0) return

  const [x0, y0, x1, y1] = gradientLine(theme)
  const fill = ctx.createLinearGradient(x0, y0, x1, y1)

  for (const [offset, alpha] of theme.gradient.stops) {
    fill.addColorStop(clamp01(offset), withAlpha(background, clamp01(alpha)))
  }

  ctx.fillStyle = fill
  ctx.fillRect(0, 0, theme.width, theme.height)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

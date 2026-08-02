import { parseColor, toCSS, withAlpha } from '../theme/color'
import type { Theme } from '../theme/types'
import { containRect, coverRect, type LoadAvatarOptions, loadAvatar } from './avatar'
import type { Image, SKRSContext2D } from './canvasFactory'
import { gradientLine } from './layout'

/**
 * Loads `theme.backgroundImage`'s source, going through the same cache and
 * fetch path an avatar uses — it is the same kind of asset, just drawn
 * somewhere else.
 */
export function loadBackgroundImage(
  theme: Theme,
  options: LoadAvatarOptions = {},
): Promise<Image | null> {
  if (!theme.backgroundImage) return Promise.resolve(null)
  return loadAvatar(theme.backgroundImage.source, options)
}

/**
 * Fills the background color, then lays `backgroundImage` over it.
 *
 * The color is not a fallback for a missing image — both can be set at once,
 * the color showing through wherever the image is translucent or, with
 * `fit: 'contain'`, letterboxed.
 */
export function drawBackground(
  ctx: SKRSContext2D,
  theme: Theme,
  backgroundImage: Image | null = null,
): void {
  const background = parseColor(theme.background, 'theme.background')
  if (background.a > 0) {
    ctx.fillStyle = toCSS(background)
    ctx.fillRect(0, 0, theme.width, theme.height)
  }

  if (!backgroundImage || !theme.backgroundImage) return

  const box = { x: 0, y: 0, width: theme.width, height: theme.height }

  ctx.save()
  ctx.globalAlpha = theme.backgroundImage.opacity
  if (theme.backgroundImage.fit === 'contain') {
    const rect = containRect(backgroundImage.width, backgroundImage.height, box)
    ctx.drawImage(backgroundImage, rect.x, rect.y, rect.width, rect.height)
  } else {
    const { sx, sy, sw, sh } = coverRect(backgroundImage.width, backgroundImage.height, box)
    ctx.drawImage(backgroundImage, sx, sy, sw, sh, 0, 0, theme.width, theme.height)
  }
  ctx.restore()
}

/**
 * Fades the avatar into the background.
 *
 * Runs sideways for the `side` layout and downwards for `stacked`; the
 * horizontal one is mirrored when the avatar is on the right.
 */
export function drawGradient(ctx: SKRSContext2D, theme: Theme): void {
  if (!theme.gradient.enabled) return

  // Past its line, a canvas gradient extends its last stop indefinitely — so
  // with a flat background this fills the far side of the canvas with an
  // opaque wash of theme.background, which is the point. With a background
  // image that wash would hide most of it, and "fade the avatar into a flat
  // color" is not a sensible effect over an image in the first place.
  if (theme.backgroundImage) return

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

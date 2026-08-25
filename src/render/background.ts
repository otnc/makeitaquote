import { parseColor, toCSS, withAlpha } from '../theme/color'
import type { BackgroundGradientDirection, Theme } from '../theme/types'
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
 * Fills the background color, lays `backgroundGradient` over it, then
 * `backgroundImage` over that.
 *
 * The color is not a fallback for either — all three can be set at once, the
 * layer below showing through wherever the one above is translucent or, with
 * `backgroundImage.fit: 'contain'`, letterboxed.
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

  drawBackgroundGradient(ctx, theme)

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
 * Draws `theme.backgroundGradient`, if set.
 *
 * A generated alternative to a flat `background` color or a pre-made
 * `backgroundImage` — a `'linear'` gradient runs edge-to-edge along
 * `direction`; a `'radial'` one fades outward from the canvas centre out to
 * its farthest corner, so it always reaches every edge regardless of aspect
 * ratio.
 */
function drawBackgroundGradient(ctx: SKRSContext2D, theme: Theme): void {
  const { backgroundGradient: gradient, width, height } = theme
  if (!gradient) return

  const fill =
    gradient.type === 'radial'
      ? ctx.createRadialGradient(
          width / 2,
          height / 2,
          0,
          width / 2,
          height / 2,
          Math.hypot(width / 2, height / 2),
        )
      : ctx.createLinearGradient(...backgroundGradientLine(gradient.direction, width, height))

  for (const [color, offset] of gradient.stops) {
    fill.addColorStop(clamp01(offset), toCSS(parseColor(color, 'theme.backgroundGradient.stops')))
  }

  ctx.fillStyle = fill
  ctx.fillRect(0, 0, width, height)
}

/** The line a `'linear'` background gradient runs along, corner to corner or edge to edge. */
function backgroundGradientLine(
  direction: BackgroundGradientDirection,
  width: number,
  height: number,
): [number, number, number, number] {
  switch (direction) {
    case 'horizontal':
      return [0, 0, width, 0]
    case 'vertical':
      return [0, 0, 0, height]
    case 'diagonal':
      return [0, 0, width, height]
    case 'diagonal-reverse':
      return [width, 0, 0, height]
  }
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
  // image, or a generated backgroundGradient, that wash would hide most of
  // it, and "fade the avatar into a flat color" is not a sensible effect over
  // either in the first place.
  if (theme.backgroundImage || theme.backgroundGradient) return

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

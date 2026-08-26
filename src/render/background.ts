import { parseColor, toCSS } from '../theme/color'
import type { BackgroundGradientDirection, Theme } from '../theme/types'
import {
  containRect,
  coverRect,
  type DrawAvatarOptions,
  drawAvatar,
  type LoadAvatarOptions,
  loadAvatar,
} from './avatar'
import { createCanvas, type Image, type SKRSContext2D } from './canvasFactory'
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
 * Draws the avatar, fading it into whatever is behind it — `background`,
 * `backgroundGradient` or `backgroundImage` — when `theme.gradient` is
 * enabled.
 *
 * Runs sideways for the `side` layout and downwards for `stacked`; the
 * horizontal one is mirrored when the avatar is on the right.
 *
 * The avatar is drawn onto its own offscreen canvas first, and the fade
 * erases its alpha there (`destination-out`) before that layer is composited
 * onto the main one. A canvas has no layers of its own — erasing the avatar
 * directly on the main canvas wouldn't "reveal" whatever is behind it, since
 * the two are already flattened together the moment it's drawn; it would
 * just punch a transparent hole where they'd been merged. Fading on a canvas
 * that holds nothing but the avatar means the erase instead reveals exactly
 * what should show through once it's composited back — whatever
 * `drawBackground()` already drew there, flat, gradient or image alike, not
 * a repainted guess at it.
 */
export function drawAvatarWithFade(
  ctx: SKRSContext2D,
  image: Image | null,
  options: DrawAvatarOptions,
  theme: Theme,
): void {
  const { box } = options

  // Fading into a transparent background would only make the avatar vanish,
  // which is not what a gradient is for.
  const background = parseColor(theme.background, 'theme.background')
  if (!theme.gradient.enabled || background.a <= 0) {
    drawAvatar(ctx, image, options)
    return
  }

  // Sized to the box, not the whole canvas — its bounds already confine the
  // fade to the avatar's own area, so nothing past its edge is ever touched.
  const width = Math.ceil(box.width)
  const height = Math.ceil(box.height)
  const layer = createCanvas(width, height)
  const layerCtx = layer.getContext('2d')

  drawAvatar(layerCtx, image, {
    ...options,
    box: { x: 0, y: 0, width: box.width, height: box.height },
  })

  const [x0, y0, x1, y1] = gradientLine(theme)
  const fill = layerCtx.createLinearGradient(x0 - box.x, y0 - box.y, x1 - box.x, y1 - box.y)

  // Only the alpha channel matters under 'destination-out' below — the color
  // itself is never seen.
  for (const [offset, alpha] of theme.gradient.stops) {
    fill.addColorStop(clamp01(offset), `rgba(0, 0, 0, ${clamp01(alpha)})`)
  }

  layerCtx.save()
  layerCtx.globalCompositeOperation = 'destination-out'
  layerCtx.fillStyle = fill
  layerCtx.fillRect(0, 0, width, height)
  layerCtx.restore()

  ctx.drawImage(layer, box.x, box.y)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

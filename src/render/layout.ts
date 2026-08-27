import { toPixels } from '../theme/resolve'
import type { Area, Theme } from '../theme/types'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Layout {
  /** Where the avatar is drawn, in pixels. */
  avatar: Rect
  /** Where the quote is laid out, in pixels. */
  text: Rect
  /** Horizontal centre for the attribution lines, in pixels. */
  centreX: number
}

/** Space left between the avatar and the quote, as a fraction of the width. */
const SIDE_GAP = 0.04

/**
 * The default quote area for a layout.
 *
 * Derived rather than hard-coded so that flipping `avatar.position`, or
 * narrowing `avatar.widthRatio`, moves the text to match instead of leaving it
 * overlapping the avatar.
 */
export function autoArea(theme: Theme): Area {
  if (theme.layout === 'new') {
    // The quote sits over the faded lower part of the avatar. Leaving the
    // bottom fifth free gives the divider and attribution somewhere to go.
    return { x: 0.08, y: 0.56, width: 0.84, height: 0.18 }
  }

  const width = Math.max(0.1, 1 - theme.avatar.widthRatio - SIDE_GAP * 2)
  const x = theme.avatar.position === 'right' ? SIDE_GAP : theme.avatar.widthRatio + SIDE_GAP

  return { x, y: 0.1, width, height: 0.68 }
}

/**
 * Rescales a theme so the avatar box matches the image's native size.
 *
 * The whole canvas scales by one factor, so the layout keeps its proportions
 * and only the resolution changes — the avatar simply stops being resampled.
 * Returns the theme untouched when there is nothing to match.
 */
export function sizeToAvatar(
  theme: Theme,
  image: { width: number; height: number } | null,
  axis: 'width' | 'height' | false | undefined,
): Theme {
  if (!axis || !image || image.width <= 0 || image.height <= 0) return theme

  const box = computeLayout(theme).avatar
  if (box.width <= 0 || box.height <= 0) return theme

  const factor = axis === 'width' ? image.width / box.width : image.height / box.height
  if (!Number.isFinite(factor) || factor <= 0) return theme

  return {
    ...theme,
    width: Math.max(1, Math.round(theme.width * factor)),
    height: Math.max(1, Math.round(theme.height * factor)),
  }
}

/** Resolves every box the renderer needs, in pixels. */
export function computeLayout(theme: Theme): Layout {
  const { width, height } = theme

  const avatarWidth = theme.layout === 'new' ? width : width * theme.avatar.widthRatio
  const avatarX =
    theme.layout === 'new' || theme.avatar.position === 'left' ? 0 : width - avatarWidth

  const area = theme.text.area === 'auto' ? autoArea(theme) : theme.text.area

  const text = {
    x: area.x * width,
    y: area.y * height,
    width: area.width * width,
    height: area.height * height,
  }

  return {
    avatar: { x: avatarX, y: 0, width: avatarWidth, height },
    text,
    centreX: text.x + text.width / 2,
  }
}

/**
 * Gradient endpoints in pixels, as `[x0, y0, x1, y1]`.
 *
 * A horizontal gradient is mirrored when the avatar is on the right, so the
 * fade always runs away from the avatar rather than into it.
 */
export function gradientLine(theme: Theme): [number, number, number, number] {
  const { gradient, width, height } = theme

  if (gradient.direction === 'vertical') {
    return [0, height * gradient.startRatio, 0, height * gradient.endRatio]
  }

  const mirrored = theme.layout === 'side' && theme.avatar.position === 'right'
  const start = mirrored ? width * (1 - gradient.startRatio) : width * gradient.startRatio
  const end = mirrored ? width * (1 - gradient.endRatio) : width * gradient.endRatio

  return [start, 0, end, 0]
}

/**
 * Resolves `watermark.position: 'auto'` to a concrete corner.
 *
 * A `side` layout puts it away from the avatar, so flipping the avatar doesn't
 * bury the watermark in it.
 */
export function watermarkCorner(theme: Theme): 'bottom-right' | 'bottom-left' | 'bottom-center' {
  if (theme.watermark.position !== 'auto') return theme.watermark.position
  if (theme.layout === 'new') return 'bottom-right'
  return theme.avatar.position === 'right' ? 'bottom-left' : 'bottom-right'
}

/** Builds the CSS font shorthand a canvas context expects. */
export function fontString(weight: string | number, size: number, family: string): string {
  return weight === 'normal' ? `${size}px ${family}` : `${weight} ${size}px ${family}`
}

/** Resolves a size that may be a fraction of the canvas height, or pixels. */
export function sizeOf(value: number, theme: Theme): number {
  return toPixels(value, theme.height)
}

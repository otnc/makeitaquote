import { ValidationError } from '../core/errors'
import { resolveFontStack } from '../font/catalogue'
import { clone, isThemePalette, presetFor } from './presets'
import type {
  BackgroundGradientDirection,
  LayoutMode,
  Theme,
  ThemeInput,
  ThemePalette,
} from './types'

const BACKGROUND_GRADIENT_DIRECTIONS = new Set<BackgroundGradientDirection>([
  'horizontal',
  'vertical',
  'diagonal',
  'diagonal-reverse',
])

/** Upper bound a caller can raise `text.maxLines` to, per layout. */
const MAX_LINES_CEILING: Record<LayoutMode, number> = { side: 20, new: 10 }

/**
 * Turns a partial theme into a complete one.
 *
 * Merges onto the preset named by `extends` (or `dark`), one level at a time — so `{ text: { color: 'red' } }` changes the color and leaves the rest of the text settings alone.
 */
export function defineTheme(input: ThemePalette | ThemeInput = 'dark'): Theme {
  if (typeof input === 'string') {
    if (!isThemePalette(input)) {
      throw new ValidationError(`Unknown theme "${input}". Expected dark, light or custom.`, {
        field: 'theme',
      })
    }
    return clone(presetFor(input, 'side'))
  }

  if (input === null || typeof input !== 'object') {
    throw new ValidationError('theme must be a palette name or an object', { field: 'theme' })
  }

  const palette = input.extends ?? 'dark'
  if (!isThemePalette(palette)) {
    throw new ValidationError(
      `Unknown theme "${palette}" in extends. Expected dark, light or custom.`,
      { field: 'theme.extends' },
    )
  }

  // Picked before merging, since it decides which base preset's own gradient/quoteMark/sizes to start from; validate() still catches a bad theme.layout on the final merged result.
  const layout: LayoutMode = input.layout === 'new' ? 'new' : 'side'

  const theme = clone(presetFor(palette, layout))
  merge(theme as unknown as Record<string, unknown>, input as Record<string, unknown>, 'theme')
  resolveFontAliases(theme)
  validate(theme)
  return theme
}

/** Resolves a font alias in every font field, so `{ font: 'pop' }` renders like `{ font: 'Hachi Maru Pop' }`. */
function resolveFontAliases(theme: Theme): void {
  theme.text.font = resolveFontStack(theme.text.font)
  theme.displayName.font = resolveFontStack(theme.displayName.font)
  theme.username.font = resolveFontStack(theme.username.font)
  theme.watermark.font = resolveFontStack(theme.watermark.font)
}

const SKIP = new Set(['extends'])

/**
 * Recursive merge that only descends into plain objects.
 *
 * Arrays (gradient stops, the quote pair) are replaced wholesale, because half of a gradient definition is not a meaningful thing to inherit.
 */
function merge(
  target: Record<string, unknown>,
  patch: Record<string, unknown>,
  path: string,
): void {
  for (const [key, value] of Object.entries(patch)) {
    if (SKIP.has(key)) continue
    if (value === undefined) continue

    const current = target[key]
    if (isPlainObject(value) && isPlainObject(current)) {
      merge(current, value, `${path}.${key}`)
      continue
    }

    if (!(key in target)) {
      throw new ValidationError(`Unknown theme property "${path}.${key}"`, {
        field: `${path}.${key}`,
      })
    }

    target[key] = value
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validate(theme: Theme): void {
  assertPositive(theme.width, 'theme.width')
  assertPositive(theme.height, 'theme.height')
  assertRatio(theme.avatar.widthRatio, 'theme.avatar.widthRatio')
  assertPositive(theme.text.lineHeight, 'theme.text.lineHeight')
  assertPositiveInteger(theme.text.maxLines, 'theme.text.maxLines')

  if (theme.layout !== 'side' && theme.layout !== 'new') {
    throw new ValidationError(`Unknown layout "${theme.layout}". Expected side or new.`, {
      field: 'theme.layout',
    })
  }

  const maxLinesCeiling = MAX_LINES_CEILING[theme.layout]
  if (theme.text.maxLines > maxLinesCeiling) {
    throw new ValidationError(
      `theme.text.maxLines must not exceed ${maxLinesCeiling} for the ${theme.layout} layout`,
      { field: 'theme.text.maxLines' },
    )
  }

  if (theme.gradient.direction !== 'horizontal' && theme.gradient.direction !== 'vertical') {
    throw new ValidationError(
      `Unknown gradient direction "${theme.gradient.direction}". Expected horizontal or vertical.`,
      { field: 'theme.gradient.direction' },
    )
  }

  if (theme.avatar.shape !== 'rectangle' && theme.avatar.shape !== 'circle') {
    throw new ValidationError(
      `Unknown avatar shape "${theme.avatar.shape}". Expected rectangle or circle.`,
      { field: 'theme.avatar.shape' },
    )
  }

  if (theme.quoteMark.chars.length !== 2) {
    throw new ValidationError('theme.quoteMark.chars must be a pair', {
      field: 'theme.quoteMark.chars',
    })
  }

  if (theme.backgroundImage) {
    const { fit, opacity } = theme.backgroundImage
    if (fit !== 'cover' && fit !== 'contain') {
      throw new ValidationError(
        `Unknown backgroundImage fit "${fit}". Expected cover or contain.`,
        {
          field: 'theme.backgroundImage.fit',
        },
      )
    }
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      throw new ValidationError('theme.backgroundImage.opacity must be between 0 and 1', {
        field: 'theme.backgroundImage.opacity',
      })
    }
  }

  if (theme.backgroundGradient) {
    const { type, direction, stops } = theme.backgroundGradient
    if (type !== 'linear' && type !== 'radial') {
      throw new ValidationError(
        `Unknown backgroundGradient type "${type}". Expected linear or radial.`,
        { field: 'theme.backgroundGradient.type' },
      )
    }
    if (!BACKGROUND_GRADIENT_DIRECTIONS.has(direction)) {
      throw new ValidationError(
        `Unknown backgroundGradient direction "${direction}". Expected horizontal, ` +
          'vertical, diagonal or diagonal-reverse.',
        { field: 'theme.backgroundGradient.direction' },
      )
    }
    if (stops.length < 2) {
      throw new ValidationError('theme.backgroundGradient.stops needs at least two stops', {
        field: 'theme.backgroundGradient.stops',
      })
    }
  }

  if (theme.text.area !== 'auto') {
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      const value = theme.text.area[key]
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new ValidationError(`theme.text.area.${key} must be between 0 and 1`, {
          field: `theme.text.area.${key}`,
        })
      }
    }
  }

  if (toPixels(theme.text.minSize, theme.height) > toPixels(theme.text.size, theme.height)) {
    throw new ValidationError('theme.text.minSize must not exceed theme.text.size', {
      field: 'theme.text.minSize',
    })
  }
}

function assertPositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError(`${field} must be a positive number`, { field })
  }
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${field} must be a positive integer`, { field })
  }
}

function assertRatio(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new ValidationError(`${field} must be between 0 and 1`, { field })
  }
}

/**
 * Reads a size that may be either a fraction or an absolute pixel value.
 *
 * Values in `(0, 1]` scale with the canvas, so a theme keeps its proportions after `setSize()`; anything larger is taken literally.
 */
export function toPixels(value: number, basis: number): number {
  return value > 0 && value <= 1 ? value * basis : value
}

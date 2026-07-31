import { ValidationError } from '../core/errors'
import { clone, isThemeName, themes } from './presets'
import type { Theme, ThemeInput, ThemeName } from './types'

/**
 * Turns a partial theme into a complete one.
 *
 * Merges onto the preset named by `extends` (or `dark`), one level at a time —
 * so `{ text: { color: 'red' } }` changes the colour and leaves the rest of the
 * text settings alone.
 */
export function defineTheme(input: ThemeName | ThemeInput = 'dark'): Theme {
  if (typeof input === 'string') {
    if (!isThemeName(input)) {
      throw new ValidationError(`Unknown theme "${input}". Expected dark, light or color.`, {
        field: 'theme',
      })
    }
    return clone(themes[input])
  }

  if (input === null || typeof input !== 'object') {
    throw new ValidationError('theme must be a preset name or an object', { field: 'theme' })
  }

  const base = input.extends ?? 'dark'
  if (!isThemeName(base)) {
    throw new ValidationError(
      `Unknown theme "${base}" in extends. Expected dark, light or color.`,
      {
        field: 'theme.extends',
      },
    )
  }

  const theme = clone(themes[base])
  merge(theme as unknown as Record<string, unknown>, input as Record<string, unknown>, 'theme')
  validate(theme)
  return theme
}

const SKIP = new Set(['extends'])

/**
 * Recursive merge that only descends into plain objects.
 *
 * Arrays (gradient stops, the quote pair) are replaced wholesale, because half
 * of a gradient definition is not a meaningful thing to inherit.
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

  if (theme.layout !== 'side' && theme.layout !== 'stacked') {
    throw new ValidationError(`Unknown layout "${theme.layout}". Expected side or stacked.`, {
      field: 'theme.layout',
    })
  }

  if (theme.gradient.direction !== 'horizontal' && theme.gradient.direction !== 'vertical') {
    throw new ValidationError(
      `Unknown gradient direction "${theme.gradient.direction}". Expected horizontal or vertical.`,
      { field: 'theme.gradient.direction' },
    )
  }

  if (theme.quoteMark.chars.length !== 2) {
    throw new ValidationError('theme.quoteMark.chars must be a pair', {
      field: 'theme.quoteMark.chars',
    })
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

function assertRatio(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new ValidationError(`${field} must be between 0 and 1`, { field })
  }
}

/**
 * Reads a size that may be either a fraction or an absolute pixel value.
 *
 * Values in `(0, 1]` scale with the canvas, so a theme keeps its proportions
 * after `setSize()`; anything larger is taken literally.
 */
export function toPixels(value: number, basis: number): number {
  return value > 0 && value <= 1 ? value * basis : value
}

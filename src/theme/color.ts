import { parse as parseCssColor, rgb as toRgb } from 'culori'
import { ValidationError } from '../core/errors'

/**
 * A color, in any of the notations this package accepts.
 *
 * - `'#RGB'`, `'#RGBA'`, `'#RRGGBB'`, `'#RRGGBBAA'`
 * - `0xRRGGBB`, `0xRRGGBBAA` — plain numbers, so `0xFF0000` is red
 * - `[r, g, b]` or `[r, g, b, a]`, channels 0–255 and alpha 0–1 or 0–255
 * - `'transparent'`, and any CSS colour name (`'rebeccapurple'`)
 * - `rgb()` / `rgba()` / `hsl()` / `hwb()` and the rest of CSS's functions
 *
 * Strings go through `culori`, so the whole CSS colour syntax is accepted rather than the handful of shapes a local regex could keep up with. Numbers and arrays are this package's own conventions and are read here.
 */
export type ColorInput = string | number | readonly number[]

export interface RGBA {
  r: number
  g: number
  b: number
  /** 0–1. */
  a: number
}

export const TRANSPARENT: RGBA = { r: 0, g: 0, b: 0, a: 0 }

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function clampAlpha(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * Alpha given as either 0–1 or 0–255.
 *
 * `1` is ambiguous — it could be "fully opaque" or "all but invisible". It is read as fully opaque, which is what anyone writing `[255, 0, 0, 1]` means.
 */
function readAlpha(value: number): number {
  if (!Number.isFinite(value)) return 1
  if (value <= 1) return clampAlpha(value)
  return clampAlpha(value / 255)
}

/** Parses any accepted notation into RGBA. Throws on anything unrecognised. */
export function parseColor(input: ColorInput, field = 'color'): RGBA {
  if (typeof input === 'number') return fromNumber(input, field)
  if (Array.isArray(input)) return fromArray(input as readonly number[], field)
  if (typeof input === 'string') return fromString(input, field)

  throw new ValidationError(
    `${field} must be a color string, a number like 0xRRGGBBAA, or [r, g, b, a]`,
    { field },
  )
}

/**
 * `0xRRGGBB` or `0xRRGGBBAA`.
 *
 * Told apart by magnitude: anything above 0xFFFFFF must carry an alpha byte. That makes `0xFF0000` red rather than transparent green, which is what people write.
 *
 * A number cannot carry a leading zero byte — `0x00FF0000` *is* `0xFF0000` — so a color with a red channel of 0 and an alpha byte has to be written as a string, where the length is part of the value.
 */
function fromNumber(value: number, field: string): RGBA {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new ValidationError(`${field} must be an integer between 0x0 and 0xFFFFFFFF`, { field })
  }

  if (value > 0xffffff) {
    return {
      r: (value >>> 24) & 0xff,
      g: (value >>> 16) & 0xff,
      b: (value >>> 8) & 0xff,
      a: (value & 0xff) / 255,
    }
  }

  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff, a: 1 }
}

function fromArray(value: readonly number[], field: string): RGBA {
  if (value.length < 3 || value.length > 4 || value.some((n) => !Number.isFinite(n))) {
    throw new ValidationError(`${field} must be [r, g, b] or [r, g, b, a] with finite numbers`, {
      field,
    })
  }

  return {
    r: clampChannel(value[0] as number),
    g: clampChannel(value[1] as number),
    b: clampChannel(value[2] as number),
    a: value.length === 4 ? readAlpha(value[3] as number) : 1,
  }
}

function fromString(input: string, field: string): RGBA {
  const value = input.trim()

  // `0xRRGGBB` as a string, which is easy to end up with coming back out of JSON. Not CSS, so the library would rightly reject it.
  if (/^0x[0-9a-f]{6,8}$/i.test(value)) return fromNumber(Number(value), field)

  // CSS identifiers and function names are ASCII case-insensitive by spec (`RED`, `RGB(...)` are as valid as their lowercase forms), but culori's own keyword/function matching only recognises the lowercase spelling.
  const parsed = parseCssColor(value.toLowerCase())
  if (!parsed) {
    throw new ValidationError(
      `${field}: could not read "${input}" as a color. Use a CSS color, ` +
        '0xRRGGBBAA, or [r, g, b, a].',
      { field },
    )
  }

  // culori keeps a colour in whatever space it was written (hsl(), lab(), …) rather than normalizing on parse, so every notation is routed through the same rgb() conversion regardless of which one it started as. Channels come back 0–1, this package's own convention is 0–255.
  const { r, g, b, alpha } = toRgb(parsed)
  return {
    r: clampChannel(r * 255),
    g: clampChannel(g * 255),
    b: clampChannel(b * 255),
    a: clampAlpha(alpha ?? 1),
  }
}

/** The canvas fill string for a color. */
export function toCSS(color: RGBA): string {
  return color.a >= 1
    ? `rgb(${color.r}, ${color.g}, ${color.b})`
    : `rgba(${color.r}, ${color.g}, ${color.b}, ${round(color.a)})`
}

/** The same color at a given alpha, for gradient stops. */
export function withAlpha(color: RGBA, alpha: number): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${round(clampAlpha(color.a * alpha))})`
}

export function isTransparent(color: RGBA): boolean {
  return color.a <= 0
}

/** Normalizes any accepted notation to `#RRGGBBAA`, for round-tripping. */
export function toHex(color: RGBA): string {
  const channels = [color.r, color.g, color.b, Math.round(color.a * 255)]
  return `#${channels.map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

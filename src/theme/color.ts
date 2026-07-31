import { ValidationError } from '../core/errors'

/**
 * A color, in any of the notations this package accepts.
 *
 * - `'#RGB'`, `'#RGBA'`, `'#RRGGBB'`, `'#RRGGBBAA'`
 * - `0xRRGGBB`, `0xRRGGBBAA` — plain numbers, so `0xFF0000` is red
 * - `[r, g, b]` or `[r, g, b, a]`, channels 0–255 and alpha 0–1 or 0–255
 * - `'transparent'`
 * - any `rgb()` / `rgba()` string the canvas understands
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

const HEX_3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX_4 = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX_6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const HEX_8 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const RGB_FN = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/i

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function clampAlpha(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * Alpha given as either 0–1 or 0–255.
 *
 * `1` is ambiguous — it could be "fully opaque" or "all but invisible". It is
 * read as fully opaque, which is what anyone writing `[255, 0, 0, 1]` means.
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
 * Told apart by magnitude: anything above 0xFFFFFF must carry an alpha byte.
 * That makes `0xFF0000` red rather than transparent green, which is what
 * people write.
 *
 * A number cannot carry a leading zero byte — `0x00FF0000` *is* `0xFF0000` —
 * so a color with a red channel of 0 and an alpha byte has to be written as
 * a string, where the length is part of the value.
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

  if (value.toLowerCase() === 'transparent') return { ...TRANSPARENT }

  const hex4 = HEX_4.exec(value)
  if (hex4) {
    return {
      r: double(hex4[1] as string),
      g: double(hex4[2] as string),
      b: double(hex4[3] as string),
      a: double(hex4[4] as string) / 255,
    }
  }

  const hex3 = HEX_3.exec(value)
  if (hex3) {
    return {
      r: double(hex3[1] as string),
      g: double(hex3[2] as string),
      b: double(hex3[3] as string),
      a: 1,
    }
  }

  const hex8 = HEX_8.exec(value)
  if (hex8) {
    return {
      r: Number.parseInt(hex8[1] as string, 16),
      g: Number.parseInt(hex8[2] as string, 16),
      b: Number.parseInt(hex8[3] as string, 16),
      a: Number.parseInt(hex8[4] as string, 16) / 255,
    }
  }

  const hex6 = HEX_6.exec(value)
  if (hex6) {
    return {
      r: Number.parseInt(hex6[1] as string, 16),
      g: Number.parseInt(hex6[2] as string, 16),
      b: Number.parseInt(hex6[3] as string, 16),
      a: 1,
    }
  }

  const fn = RGB_FN.exec(value)
  if (fn) {
    const alpha = fn[4]
    return {
      r: clampChannel(Number(fn[1])),
      g: clampChannel(Number(fn[2])),
      b: clampChannel(Number(fn[3])),
      a:
        alpha === undefined
          ? 1
          : alpha.endsWith('%')
            ? clampAlpha(Number.parseFloat(alpha) / 100)
            : readAlpha(Number(alpha)),
    }
  }

  // `0xRRGGBB` written as a string, which is easy to end up with from JSON.
  if (/^0x[0-9a-f]{6,8}$/i.test(value)) return fromNumber(Number(value), field)

  throw new ValidationError(
    `${field}: could not read "${input}" as a color. Use #RRGGBBAA, 0xRRGGBBAA, ` +
      "[r, g, b, a], 'transparent', or rgb()/rgba().",
    { field },
  )
}

function double(digit: string): number {
  return Number.parseInt(`${digit}${digit}`, 16)
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

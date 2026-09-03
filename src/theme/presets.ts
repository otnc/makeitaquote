import { DEFAULT_FONT_FAMILIES, FALLBACK_FAMILY } from '../font/sources'
import type { LayoutMode, Theme, ThemePalette } from './types'

/**
 * The default stack.
 *
 * M PLUS Rounded 1c first, Noto Sans JP behind it for anything the rounded
 * face does not cover. Skia resolves a stack per glyph, so this is a genuine
 * fallback rather than an either/or.
 *
 * Built from `DEFAULT_FONT_FAMILIES` rather than retyping the same two names,
 * so the two can't quietly drift apart.
 */
const SANS = [...DEFAULT_FONT_FAMILIES, FALLBACK_FAMILY].join(', ')

/**
 * The default palettes.
 *
 * Exported so a custom theme can pick them up rather than re-typing hex, and
 * so the two presets are visibly one decision rather than two.
 */
export const palettes = {
  dark: {
    background: '#000000',
    text: '#FFFFFF',
    muted: '#9A9A9A',
    faint: '#6E6E6E',
    avatarFallback: { background: '#1E1E1E', color: '#8A8A8A' },
  },
  light: {
    background: '#FFFFFF',
    text: '#111111',
    muted: '#666666',
    faint: '#999999',
    avatarFallback: { background: '#E8E8E8', color: '#7A7A7A' },
  },
} as const

/**
 * What `api.voids.top` actually renders at, verified by calling it directly.
 * Not 16:9 — close, but a real bot generates the images this package is
 * named after, so its size is the one that matters here, not a round ratio.
 */
const LANDSCAPE = { width: 1200, height: 630 }

/** The same bot's vertical mode, for the `new` layout. */
const NEW_LAYOUT_SIZE = { width: 630, height: 790 }

/**
 * The original Make it a Quote look: black background, desaturated avatar on
 * the left fading into it, centred white quote on the right.
 */
const dark: Theme = {
  layout: 'side',
  ...LANDSCAPE,
  background: palettes.dark.background,
  backgroundImage: null,
  backgroundGradient: null,
  avatar: {
    grayscale: true,
    position: 'left',
    widthRatio: 0.5,
    fit: 'cover',
    shape: 'rectangle',
    fallback: { ...palettes.dark.avatarFallback },
  },
  gradient: {
    enabled: true,
    direction: 'horizontal',
    startRatio: 0.22,
    // Reaches the background color exactly at the avatar's edge
    // (avatar.widthRatio), so the edge itself never shows as a hard line.
    endRatio: 0.5,
    stops: [
      [0, 0],
      [0.55, 0.8],
      [1, 1],
    ],
  },
  text: {
    color: palettes.dark.text,
    font: SANS,
    weight: 'normal',
    size: 0.062,
    minSize: 0.03,
    lineHeight: 1.35,
    maxLines: 13,
    align: 'center',
    overflow: 'ellipsis',
    area: 'auto',
    phraseBreak: true,
    locale: 'ja',
  },
  quoteMark: {
    display: 'none',
    chars: ['“', '”'],
    size: 0.12,
    color: null,
    weight: 'bold',
    gap: 0.03,
  },
  divider: {
    enabled: false,
    widthRatio: 0.45,
    thickness: 0.004,
    color: null,
    gap: 0.03,
  },
  displayName: {
    color: palettes.dark.text,
    font: SANS,
    weight: 'normal',
    size: 0.04,
    prefix: '- ',
  },
  username: {
    color: palettes.dark.muted,
    font: SANS,
    weight: 'normal',
    size: 0.028,
    prefix: '@',
  },
  watermark: {
    color: palettes.dark.faint,
    font: SANS,
    weight: 'normal',
    size: 0.024,
    imageSize: null,
    position: 'auto',
  },
  emoji: { sideMarginRatio: 0.08, topMarginRatio: 0.1, size: 64 },
}

/** Same layout on white. */
const light: Theme = {
  ...clone(dark),
  background: palettes.light.background,
  avatar: { ...clone(dark).avatar, fallback: { ...palettes.light.avatarFallback } },
  text: { ...clone(dark).text, color: palettes.light.text },
  displayName: { ...dark.displayName, color: palettes.light.text },
  username: { ...dark.username, color: palettes.light.muted },
  watermark: { ...dark.watermark, color: palettes.light.faint },
}

/**
 * The `new` layout: the avatar fills the canvas and fades downwards, with big
 * quote marks, the quote, a rule and the attribution laid over the bottom of
 * it.
 */
const darkNew: Theme = {
  ...clone(dark),
  layout: 'new',
  ...NEW_LAYOUT_SIZE,
  avatar: { ...clone(dark).avatar, widthRatio: 1, position: 'left' },
  gradient: {
    ...clone(dark).gradient,
    direction: 'vertical',
    // The avatar is the top half of a `new`-layout quote, so it has to stay
    // legible there. Fading from 12% swallowed the subject's face before the
    // text needed the space; this keeps the fade below it and only reaches the
    // background where the quote actually sits.
    startRatio: 0.38,
    endRatio: 0.74,
    stops: [
      [0, 0],
      [0.6, 0.7],
      [1, 1],
    ],
  },
  text: { ...clone(dark).text, size: 0.055, minSize: 0.028, maxLines: 5, area: 'auto' },
  quoteMark: { ...clone(dark).quoteMark, display: 'block' },
  divider: { ...clone(dark).divider, enabled: true },
  displayName: { ...clone(dark).displayName, size: 0.036, prefix: '' },
  username: { ...clone(dark).username, size: 0.022, prefix: '@' },
}

const lightNew: Theme = {
  ...clone(darkNew),
  background: palettes.light.background,
  avatar: { ...clone(darkNew).avatar, fallback: { ...palettes.light.avatarFallback } },
  text: { ...clone(darkNew).text, color: palettes.light.text },
  displayName: { ...clone(darkNew).displayName, color: palettes.light.text },
  username: { ...clone(darkNew).username, color: palettes.light.muted },
  watermark: { ...clone(darkNew).watermark, color: palettes.light.faint },
}

/**
 * A blank slate: everything transparent, for compositing over something else.
 *
 * The avatar and its gradient still draw — it is the background and the text
 * that start invisible, so you set exactly the colors you want and nothing
 * else shows up uninvited.
 */
const custom: Theme = {
  ...clone(dark),
  background: 'transparent',
  avatar: { ...clone(dark).avatar, fallback: null },
  text: { ...clone(dark).text, color: 'transparent' },
  displayName: { ...clone(dark).displayName, color: 'transparent' },
  username: { ...clone(dark).username, color: 'transparent' },
  watermark: { ...clone(dark).watermark, color: 'transparent' },
}

/** The `new`-layout counterpart to `custom`, same relationship `darkNew` has to `dark`. */
const customNew: Theme = {
  ...clone(darkNew),
  background: 'transparent',
  avatar: { ...clone(darkNew).avatar, fallback: null },
  text: { ...clone(darkNew).text, color: 'transparent' },
  displayName: { ...clone(darkNew).displayName, color: 'transparent' },
  username: { ...clone(darkNew).username, color: 'transparent' },
  watermark: { ...clone(darkNew).watermark, color: 'transparent' },
}

/** Every base preset, by palette then layout. */
export const themes: Record<ThemePalette, Record<LayoutMode, Theme>> = {
  dark: { side: dark, new: darkNew },
  light: { side: light, new: lightNew },
  custom: { side: custom, new: customNew },
}

const PALETTES = new Set<string>(Object.keys(themes))

export function isThemePalette(value: unknown): value is ThemePalette {
  return typeof value === 'string' && PALETTES.has(value)
}

export const themePaletteNames = Object.keys(themes) as ThemePalette[]

/** The base preset for a palette/layout combination. */
export function presetFor(palette: ThemePalette, layout: LayoutMode): Theme {
  return themes[palette][layout]
}

/**
 * A deep copy, so presets can never be mutated by a caller.
 *
 * `structuredClone` can't handle every `BackgroundImageSource`: a `URL`
 * throws ("Cannot clone object of unsupported type"), and a `Buffer` clones
 * but is silently demoted to a plain `Uint8Array`. Carried through by
 * reference instead when present — nothing here ever mutates it, so sharing
 * the same instance across a clone is safe.
 */
export function clone(value: Theme): Theme {
  const image = value.backgroundImage
  if (!image || typeof image.source === 'string') return structuredClone(value)

  const { source, ...rest } = image
  const copy = structuredClone({ ...value, backgroundImage: rest })
  return { ...copy, backgroundImage: { ...copy.backgroundImage, source } }
}

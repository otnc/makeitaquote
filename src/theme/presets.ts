import type { Theme, ThemeName } from './types'

/**
 * The default stack.
 *
 * M PLUS Rounded 1c first, Noto Sans JP behind it for anything the rounded
 * face does not cover. Skia resolves a stack per glyph, so this is a genuine
 * fallback rather than an either/or.
 */
const SANS = 'M PLUS Rounded 1c, Noto Sans JP, sans-serif'

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

/** Height of a landscape canvas, and width of a portrait one. */
export const DEFAULT_LONG_EDGE = 800

/** 16:9, the shape the original Make it a Quote images are. */
const LANDSCAPE = { width: Math.round((DEFAULT_LONG_EDGE * 16) / 9), height: DEFAULT_LONG_EDGE }

/** 4:5 — portrait, with the long edge as the width per the same convention. */
const PORTRAIT = { width: DEFAULT_LONG_EDGE, height: Math.round((DEFAULT_LONG_EDGE * 5) / 4) }

/**
 * The original Make it a Quote look: black background, desaturated avatar on
 * the left fading into it, centred white quote on the right.
 */
const dark: Theme = {
  layout: 'side',
  ...LANDSCAPE,
  background: palettes.dark.background,
  backgroundImage: null,
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

/** Leaves the avatar in color — the v8 `setColor(true)` behaviour. */
const color: Theme = {
  ...clone(dark),
  avatar: { ...clone(dark).avatar, grayscale: false },
}

/**
 * Portrait: the avatar fills the canvas and fades downwards, with big quote
 * marks, the quote, a rule and the attribution stacked over the bottom of it.
 */
const portrait: Theme = {
  ...clone(dark),
  layout: 'stacked',
  ...PORTRAIT,
  avatar: { ...clone(dark).avatar, widthRatio: 1, position: 'left' },
  gradient: {
    ...clone(dark).gradient,
    direction: 'vertical',
    // The avatar is the top half of a portrait quote, so it has to stay
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
  text: { ...clone(dark).text, size: 0.055, minSize: 0.028, area: 'auto' },
  quoteMark: { ...clone(dark).quoteMark, display: 'block' },
  divider: { ...clone(dark).divider, enabled: true },
  displayName: { ...clone(dark).displayName, size: 0.036, prefix: '' },
  username: { ...clone(dark).username, size: 0.022, prefix: '@' },
}

const portraitLight: Theme = {
  ...clone(portrait),
  background: palettes.light.background,
  avatar: { ...clone(portrait).avatar, fallback: { ...palettes.light.avatarFallback } },
  text: { ...clone(portrait).text, color: palettes.light.text },
  displayName: { ...clone(portrait).displayName, color: palettes.light.text },
  username: { ...clone(portrait).username, color: palettes.light.muted },
  watermark: { ...clone(portrait).watermark, color: palettes.light.faint },
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

export const themes: Record<ThemeName, Theme> = {
  dark,
  light,
  color,
  portrait,
  'portrait-light': portraitLight,
  custom,
}

const NAMES = new Set<string>(Object.keys(themes))

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && NAMES.has(value)
}

export const themeNames = Object.keys(themes) as ThemeName[]

/** A deep copy, so presets can never be mutated by a caller. */
export function clone<T>(value: T): T {
  return structuredClone(value)
}

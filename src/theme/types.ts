import type { ColorInput } from './color'

/**
 * A built-in color palette — combined with `layout` to pick a base preset. `'custom'` starts fully transparent, for compositing your own colors over.
 */
export type ThemePalette = 'dark' | 'light' | 'custom'

/**
 * How the avatar and the quote are arranged.
 *
 * - `side` puts them next to each other, the avatar fading sideways into the background.
 * - `new` fills the canvas with the avatar and fades it downwards, with the quote sitting over the bottom of it. Suits a tall canvas.
 */
export type LayoutMode = 'side' | 'new'

/** BudouX model used to find phrase boundaries. `'none'` disables phrase breaking. */
export type PhraseLocale = 'ja' | 'zh-hans' | 'zh-hant' | 'none'

export type TextOverflow = 'ellipsis' | 'shrink' | 'error'

/** A CSS font weight: a keyword, or 100–900. */
export type FontWeight = 'normal' | 'bold' | 'lighter' | 'bolder' | number

export interface AvatarTheme {
  /** Draw the avatar in black and white. */
  grayscale: boolean
  /** Which side it sits on. Ignored when the layout is `new`. */
  position: 'left' | 'right'
  /** Fraction of the canvas width it occupies. Forced to 1 when `new`. */
  widthRatio: number
  /**
   * How the image fills its box.
   *
   * - `cover` crops to fill it, the usual choice
   * - `contain` fits the whole image inside, leaving background either side
   *
   * See also `MiQOptions.sizeToAvatar`, which reshapes the canvas around the image instead of reshaping the image.
   */
  fit: 'cover' | 'contain'
  /**
   * The mask the avatar (and its fallback tile) is clipped to.
   *
   * `circle` inscribes the largest circle that fits the box, centred — for a wide or tall box that leaves background showing at the sides or top and bottom, same as a round profile picture would on any other card shape.
   */
  shape: 'rectangle' | 'circle'
  /** Drawn when there is no avatar, or fetching one failed. `null` leaves it blank. */
  fallback: { background: ColorInput; color: ColorInput } | null
}

export interface GradientTheme {
  enabled: boolean
  /**
   * Which way the avatar fades into the background.
   *
   * `horizontal` is mirrored automatically when the avatar is on the right.
   */
  direction: 'horizontal' | 'vertical'
  /** Where the fade starts, as a fraction of the canvas width or height. */
  startRatio: number
  /** Where it reaches the background color. */
  endRatio: number
  /** `[offset, alpha]` pairs, offsets in 0–1 across the gradient. */
  stops: Array<[offset: number, alpha: number]>
}

/** A rectangle in fractions of the canvas size. */
export interface Area {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Where the quote goes.
 *
 * `'auto'` derives it from the layout and the avatar's side, so flipping the avatar moves the text with it.
 */
export type AreaSetting = Area | 'auto'

export interface TextTheme {
  color: ColorInput
  font: string
  weight: FontWeight
  /**
   * Starting font size.
   *
   * Values in `(0, 1]` are read as a fraction of the canvas height; anything larger is taken as pixels.
   */
  size: number
  /** Lower bound for the auto-fit search, same units as `size`. */
  minSize: number
  lineHeight: number
  /**
   * Hard cap on the number of lines, independent of the box height.
   *
   * Defaults to 13 for `side`, 5 for `new`; can be raised up to 20 for `side` or 10 for `new`.
   */
  maxLines: number
  align: 'left' | 'center' | 'right'
  overflow: TextOverflow
  area: AreaSetting
  /** Use BudouX phrase boundaries when breaking CJK lines. */
  phraseBreak: boolean
  locale: PhraseLocale
}

export interface QuoteMarkTheme {
  /**
   * - `inline` wraps the quote in the marks, as running text
   * - `block` draws them large above the quote
   * - `none` omits them
   */
  display: 'inline' | 'block' | 'none'
  chars: [open: string, close: string]
  /** `block` only: size, as a fraction of the canvas height or in pixels. */
  size: number
  /** `null` inherits the text color. */
  color: ColorInput | null
  weight: FontWeight
  /** `block` only: space between the marks and the quote. */
  gap: number
}

export interface DividerTheme {
  /** A rule between the quote and the attribution. */
  enabled: boolean
  /** Length, as a fraction of the text area's width. */
  widthRatio: number
  /** Line thickness, as a fraction of the canvas height or in pixels. */
  thickness: number
  /** `null` inherits the display name's color. */
  color: ColorInput | null
  /** Space above and below. */
  gap: number
}

export interface LabelTheme {
  color: ColorInput
  font: string
  weight: FontWeight
  size: number
  prefix: string
}

export interface WatermarkTheme {
  color: ColorInput
  font: string
  weight: FontWeight
  size: number
  /**
   * Height of an image watermark, in place of `size`. `null` (default): the image uses `size` too, same as before this existed. `size` is tuned for a short text tag and reads small for a logo, so this exists to size the two forms independently without one dragging the other along.
   */
  imageSize: number | null
  /** Distance from the canvas edge on both axes, as a fraction of the canvas size (or pixels above 1). */
  margin: number
  /**
   * `'auto'` keeps it clear of the avatar: opposite side for `side` layouts, bottom right for `new` ones.
   */
  position: 'auto' | 'bottom-right' | 'bottom-left' | 'bottom-center'
}

export interface EmojiTheme {
  /** Horizontal padding around an emoji, as a fraction of the font size. */
  sideMarginRatio: number
  topMarginRatio: number
  /** Pixel size requested from the CDN. */
  size: 64 | 72 | 128
}

/**
 * Anything that can stand in for a background image.
 *
 * The same shape as `AvatarSource` in `core/types.ts`, restated here rather than imported — `core/types.ts` imports `Theme` from this module, so the other way round would be circular.
 */
export type BackgroundImageSource = string | URL | Buffer | Uint8Array

export interface BackgroundImageTheme {
  source: BackgroundImageSource
  /** `cover` (default) crops to fill the canvas; `contain` fits it whole. */
  fit: 'cover' | 'contain'
  /** 0–1, default 1. Blended over `background`, not a replacement for it. */
  opacity: number
}

/** Which way a `'linear'` background gradient runs. Ignored for `'radial'`. */
export type BackgroundGradientDirection =
  | 'horizontal'
  | 'vertical'
  | 'diagonal'
  | 'diagonal-reverse'

export interface BackgroundGradientTheme {
  /** `'linear'` runs along `direction`; `'radial'` fades outward from the canvas centre. */
  type: 'linear' | 'radial'
  direction: BackgroundGradientDirection
  /**
   * Color at each stop, 0–1 along the gradient — two or more, in any order. A translucent color lets `background` show through underneath it.
   */
  stops: ReadonlyArray<readonly [color: ColorInput, offset: number]>
}

export interface Theme {
  layout: LayoutMode
  width: number
  height: number
  background: ColorInput
  /** Drawn over `background` and behind everything else. `null` (default): none. */
  backgroundImage: BackgroundImageTheme | null
  /**
   * A generated gradient fill, drawn over `background` and behind `backgroundImage`. `null` (default): none.
   */
  backgroundGradient: BackgroundGradientTheme | null
  avatar: AvatarTheme
  gradient: GradientTheme
  text: TextTheme
  quoteMark: QuoteMarkTheme
  divider: DividerTheme
  displayName: LabelTheme
  username: LabelTheme
  watermark: WatermarkTheme
  emoji: EmojiTheme
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends object | undefined
      ? DeepPartial<NonNullable<T[K]>> | Extract<T[K], null | undefined | 'auto'>
      : T[K]
}

export type ThemeInput = DeepPartial<Theme> & {
  /** Palette to start from. Defaults to `'dark'`. Combines with `layout`. */
  extends?: ThemePalette
}

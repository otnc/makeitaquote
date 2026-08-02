import type { Readable } from 'node:stream'
import { encode, encodeDataURL, encodeStream } from '../output/encode'
import type { Canvas } from '../render/canvasFactory'
import { renderQuote } from '../render/pipeline'
import { defineTheme } from '../theme/resolve'
import type { Theme, ThemeInput, ThemeName } from '../theme/types'
import { deprecate } from './deprecate'
import { ValidationError } from './errors'
import { fromNote } from './note'
import {
  applyInput,
  emptyQuote,
  normalizeAvatar,
  normalizeDisplayName,
  normalizeText,
  normalizeUsername,
  normalizeWatermark,
} from './quote'
import { fromMessage } from './source'

/** Above this a render is more likely a mistake than an intention. */
const MAX_SCALE = 8

import type {
  AvatarSource,
  EncodeOptions,
  MessageLike,
  MessageSourceOptions,
  MiQOptions,
  NoteLike,
  NoteSourceOptions,
  OutputFormat,
  QuoteData,
  QuoteInput,
} from './types'

/**
 * Builds a "Make it a Quote" image locally.
 *
 * ```ts
 * const png = await new MiQ()
 *   .setText('吾輩は猫である。')
 *   .setAvatar(avatarUrl)
 *   .setUsername('otoneko.')
 *   .toBuffer('png')
 * ```
 *
 * Nothing is drawn, fetched or downloaded until an output method is called.
 */
export class MiQ {
  #data: QuoteData = emptyQuote()
  #theme: Theme
  #options: MiQOptions

  constructor(options: MiQOptions = {}) {
    this.#options = { ...options }
    this.#theme = defineTheme(options.theme ?? 'dark')
  }

  setText(text: string): this {
    this.#data.text = normalizeText(text)
    return this
  }

  setAvatar(avatar: AvatarSource | null): this {
    this.#data.avatar = normalizeAvatar(avatar)
    return this
  }

  setUsername(username: string): this {
    this.#data.username = normalizeUsername(username)
    return this
  }

  setDisplayName(displayName: string): this {
    this.#data.displayName = normalizeDisplayName(displayName)
    return this
  }

  setWatermark(watermark: string): this {
    this.#data.watermark = normalizeWatermark(watermark)
    return this
  }

  setFromMessage(message: MessageLike, options?: MessageSourceOptions): this {
    this.#data = fromMessage(message, options)
    return this
  }

  /**
   * Reads a Misskey note the way `setFromMessage()` reads a Discord message.
   *
   * Takes what the API returns for a note, unchanged. MFM is stripped by
   * default — see `NoteSourceOptions`.
   */
  setFromNote(note: NoteLike, options?: NoteSourceOptions): this {
    this.#data = fromNote(note, options)
    return this
  }

  /**
   * Merges a partial quote.
   *
   * `color: true` is accepted for symmetry with the API client, where it is a
   * wire field; here it selects the `color` theme.
   */
  setFromObject(input: QuoteInput): this {
    this.#data = applyInput(this.#data, input)
    if (input.color === true) this.setTheme('color')
    return this
  }

  setTheme(theme: ThemeName | ThemeInput): this {
    const width = this.#theme.width
    const height = this.#theme.height
    this.#theme = defineTheme(theme)

    // A theme change shouldn't silently undo an explicit setSize().
    if (typeof theme === 'object' && theme.width === undefined) this.#theme.width = width
    if (typeof theme === 'object' && theme.height === undefined) this.#theme.height = height

    return this
  }

  /**
   * @deprecated Setting both dimensions by hand fights the theme: every size
   * in a theme is a fraction of the canvas, so an arbitrary aspect ratio moves
   * the avatar, the gradient and the text out of proportion with each other.
   *
   * Use {@link setScale} to make the same layout bigger or smaller, or set
   * `width`/`height` on a theme if you genuinely want a different shape.
   */
  setSize(width: number, height: number): this {
    deprecate(
      'MiQ#setSize',
      'MiQ#setSize() is deprecated: it changes the aspect ratio without adjusting the ' +
        'layout around it. Use MiQ#setScale(factor) to resize, or setTheme({ width, height }) ' +
        'if you really do want a different shape.',
    )
    return this.#applySize(width, height)
  }

  /**
   * Scales the canvas, keeping the layout identical.
   *
   * Every measurement in a theme is a fraction of the canvas, so this is a
   * true zoom: a 2× image is the 1× image at twice the resolution, not a
   * differently-composed one.
   */
  setScale(factor: number): this {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new ValidationError('scale must be a positive number', { field: 'scale' })
    }
    if (factor > MAX_SCALE) {
      throw new ValidationError(`scale must be at most ${MAX_SCALE}`, { field: 'scale' })
    }

    return this.#applySize(this.#theme.width * factor, this.#theme.height * factor)
  }

  #applySize(width: number, height: number): this {
    for (const [value, field] of [
      [width, 'width'],
      [height, 'height'],
    ] as const) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new ValidationError(`${field} must be a positive number`, { field })
      }
    }

    this.#theme.width = Math.round(width)
    this.#theme.height = Math.round(height)
    return this
  }

  getData(): Readonly<QuoteData> {
    return { ...this.#data }
  }

  getTheme(): Readonly<Theme> {
    return structuredClone(this.#theme)
  }

  clone(): MiQ {
    const copy = new MiQ(this.#options)
    copy.#data = { ...this.#data }
    copy.#theme = structuredClone(this.#theme)
    return copy
  }

  /** The rendered canvas, for callers who want to draw on top of it. */
  async render(): Promise<Canvas> {
    return renderQuote(this.#data, { ...this.#options, theme: this.#theme })
  }

  async toBuffer(format: OutputFormat = 'png', options?: EncodeOptions): Promise<Buffer> {
    return encode(await this.render(), format, options)
  }

  async toStream(format: OutputFormat = 'png', options?: EncodeOptions): Promise<Readable> {
    return encodeStream(await this.render(), format, options)
  }

  async toDataURL(format: OutputFormat = 'png', options?: EncodeOptions): Promise<string> {
    return encodeDataURL(await this.render(), format, options)
  }
}

import type { Readable } from 'node:stream'
import { encode, encodeDataURL, encodeStream } from '../output/encode'
import { type Canvas, createCanvas } from '../render/canvasFactory'
import type { Theme } from '../theme/types'
import { ValidationError } from './errors'
import type { MiQ } from './MiQ'
import type { ChainOptions, EncodeOptions, OutputFormat } from './types'

/**
 * Stacks two already-built `MiQ` quotes into one image — a reply/quote pair,
 * the way Discord, X and Misskey all have one.
 *
 * ```ts
 * const png = await new MiQChain(
 *   new MiQ().setText('元の投稿').setUsername('otoneko.'),
 *   new MiQ().setText('それへの返信').setUsername('ねこ'),
 * ).toBuffer('png')
 * ```
 *
 * Each `MiQ` keeps whatever it was already configured with — theme, bold,
 * color, `markdown`, everything — `MiQChain` only decides which side each
 * one's avatar sits on (see `ChainOptions`); neither `MiQ` passed in is
 * mutated. Nothing is drawn, fetched or downloaded until an output method is
 * called.
 */
export class MiQChain {
  #top: MiQ
  #bottom: MiQ
  #options: ChainOptions

  constructor(top: MiQ, bottom: MiQ, options: ChainOptions = {}) {
    this.#top = top
    this.#bottom = bottom
    this.#options = { ...options }
  }

  /** The rendered canvas, for callers who want to draw on top of it. */
  async render(): Promise<Canvas> {
    const top = withAvatarPosition(this.#top, resolvePosition(this.#options, true))
    const bottom = withAvatarPosition(this.#bottom, resolvePosition(this.#options, false))

    assertChainable(top, 'top')
    assertChainable(bottom, 'bottom')

    const [topCanvas, bottomCanvas] = await Promise.all([top.render(), bottom.render()])

    if (topCanvas.width !== bottomCanvas.width) {
      throw new ValidationError(
        `top and bottom must render at the same width (top: ${topCanvas.width}, bottom: ` +
          `${bottomCanvas.width}) — match their theme widths, or setScale(), before chaining`,
        { field: 'width' },
      )
    }

    const canvas = createCanvas(topCanvas.width, topCanvas.height + bottomCanvas.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(topCanvas, 0, 0)
    ctx.drawImage(bottomCanvas, 0, topCanvas.height)

    return canvas
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

/**
 * A clone of `miq` with `avatar.position` overridden, everything else about
 * its theme untouched.
 *
 * `MiQ#setTheme()` doesn't merge onto the instance's current theme — it
 * resolves a fresh one from `{ extends, layout }` plus whatever the input
 * sets (see `defineTheme()`), so `clone().setTheme({ avatar: { position } })`
 * would silently reset every other theme field (palette, `layout`, sizes, …)
 * to the `'dark'`/`'side'` defaults. Round-tripping through a full
 * `getTheme()` snapshot — mutating just `avatar.position` on it — keeps
 * `defineTheme()`'s merge a no-op for every field except this one, since a
 * complete `Theme` object supplies its own value for all of them, `layout`
 * included (the one field `defineTheme()` reads before merging, to pick
 * which preset shape to start from).
 */
function withAvatarPosition(miq: MiQ, position: 'left' | 'right'): MiQ {
  const clone = miq.clone()
  const theme = clone.getTheme() as Theme
  theme.avatar.position = position
  clone.setTheme(theme)
  return clone
}

/**
 * The `avatar.position` for one half.
 *
 * A per-side override (`topFlip`/`bottomFlip`) wins outright. Otherwise the
 * default pairing is top=`'right'`, bottom=`'left'` — `flip` swaps that.
 */
export function resolvePosition(options: ChainOptions, isTop: boolean): 'left' | 'right' {
  const override = isTop ? options.topFlip : options.bottomFlip
  if (override !== undefined) return override ? 'right' : 'left'

  const flip = options.flip ?? false
  const defaultSide = isTop ? 'right' : 'left'
  const flippedSide = isTop ? 'left' : 'right'
  return flip ? flippedSide : defaultSide
}

/** `layout: 'new'` has no left/right avatar box to pair, so it isn't supported yet. */
function assertChainable(miq: MiQ, side: 'top' | 'bottom'): void {
  if (miq.getTheme().layout === 'new') {
    throw new ValidationError(`MiQChain does not support layout: 'new' yet (${side})`, {
      field: `${side}.layout`,
    })
  }
}

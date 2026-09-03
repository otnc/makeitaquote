import { assertRenderable, effectiveDisplayName } from '../core/quote'
import type { MiQOptions, QuoteData, Segment, StyledRun } from '../core/types'
import { type EmojiImages, prefetchEmoji } from '../emoji/loader'
import { ensureDefaultFonts, reportMissingFonts, useFont } from '../font/autoload'
import { GENERIC_FONT_FAMILIES, unquoteFontFamily } from '../font/catalogue'
import { fonts, resolveFamily } from '../font/registry'
import { DEFAULT_FONT_FAMILIES, FALLBACK_FAMILY } from '../font/sources'
import { parseDiscordMarkdown } from '../text/discordMarkdown'
import { alignedX, type DrawLineOptions, drawLine, measureLine } from '../text/draw'
import { fitText } from '../text/fit'
import { parseMarkdown } from '../text/markdown'
import { memoizeMeasurer } from '../text/measure'
import { parseMfm } from '../text/mfm'
import { resolveEmojiSegments, segmentStyledText } from '../text/segment'
import { parseTwitterText } from '../text/twitterText'
import { isTransparent, parseColor, toCSS } from '../theme/color'
import { toPixels } from '../theme/resolve'
import type { FontWeight, LabelTheme, Theme } from '../theme/types'
import { avatarBox, loadAvatar } from './avatar'
import { drawAvatarWithFade, drawBackground, loadBackgroundImage } from './background'
import { type Canvas, createCanvas, type Image, type SKRSContext2D } from './canvasFactory'
import { coveringStack, needsGlyphFallback } from './glyphs'
import { computeLayout, fontString, type Layout, sizeToAvatar, watermarkCorner } from './layout'
import { boldAdvance, fillText, resolvedWeight, syntheticBoldWidth } from './textStyle'

/**
 * Turns `data.text` into styled runs per `data.markdown`.
 *
 * `'raw'` is the one case with nothing to parse — the text is drawn exactly as written, one unstyled run. Every other mode's dialect is picked by the mode itself, independent of how the quote was built (`setFromMessage()` and `setText()` can both ask for `'discord'` rendering, say).
 */
function styledRunsFor(data: QuoteData): StyledRun[] {
  switch (data.markdown) {
    case true:
      return parseMarkdown(data.text)
    case 'discord':
      return parseDiscordMarkdown(data.text)
    case 'misskey':
      return parseMfm(data.text)
    case 'twitter':
      return parseTwitterText(data.text)
    default:
      return [{ value: data.text }]
  }
}

export interface RenderOptions extends MiQOptions {
  theme: Theme
}

/**
 * Renders a quote to a canvas.
 *
 * Every asset is fetched before anything is drawn, so the drawing pass itself is synchronous and a quote with twenty emoji costs one parallel round of requests rather than twenty sequential ones.
 */
export async function renderQuote(data: QuoteData, options: RenderOptions): Promise<Canvas> {
  assertRenderable(data)

  const { theme: requested } = options
  const segments = segmentStyledText(styledRunsFor(data), {
    emojiSize: requested.emoji.size,
    ...(options.misskey ? { misskey: options.misskey } : {}),
  })

  const [images, backgroundImage, , avatar, watermarkImage] = await Promise.all([
    prefetchEmoji(segments, {
      ...(options.signal ? { signal: options.signal } : {}),
    }),
    loadBackgroundImage(requested, options.signal ? { signal: options.signal } : {}),
    prepareFonts(requested, data.text, options),
    loadAvatar(data.avatar, options.signal ? { signal: options.signal } : {}),
    loadAvatar(data.watermarkImage, options.signal ? { signal: options.signal } : {}),
  ])

  // Emoji that could not be fetched become plain text now, so layout and drawing agree on their width from here on.
  const resolved = resolveEmojiSegments(
    segments,
    (url) => images.get(url) !== undefined,
    options.onAssetError ?? 'text',
  )

  // Reshaping happens after the avatar is known, since its native size is the whole input to the decision.
  const theme = sizeToAvatar(requested, avatar, options.sizeToAvatar)

  const canvas = createCanvas(theme.width, theme.height)
  const ctx = canvas.getContext('2d')
  const layout = computeLayout(theme)

  drawBackground(ctx, theme, backgroundImage)

  const box = avatarBox(layout)
  drawAvatarWithFade(
    ctx,
    avatar,
    {
      theme: theme.avatar,
      box,
      initial: effectiveDisplayName(data),
      fallbackFont: familyFor(theme.text.font),
    },
    theme,
  )

  const quoteBottom = drawQuote(ctx, resolved, images, theme, layout, options)
  const afterDivider = drawDivider(ctx, theme, layout, quoteBottom)
  drawAttribution(ctx, data, theme, layout, afterDivider)
  drawWatermark(ctx, data, theme, watermarkImage)

  return canvas
}

/**
 * Makes sure something can draw the requested text.
 *
 * Only downloads when the theme's families are genuinely unavailable — on a machine with Japanese fonts installed this never touches the network.
 */
async function prepareFonts(theme: Theme, text: string, options: RenderOptions): Promise<void> {
  const requests = [
    theme.text.font,
    theme.displayName.font,
    theme.username.font,
    theme.watermark.font,
  ]
  const autoFont = options.autoFont ?? true
  if (autoFont !== false) {
    const autoOptions = {
      ...(typeof autoFont === 'object' ? autoFont : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    }

    await Promise.all([...new Set(requests)].map((request) => ensureStack(request, autoOptions)))

    // A display font may cover no Japanese at all, so the default family has to be present as well — it is what the quote falls through to.
    if (needsGlyphFallback(text)) await ensureDefaultFonts(autoOptions)

    if (requests.some((request) => resolveFamily(request) === null)) {
      await ensureDefaultFonts(autoOptions)
    }
  }

  const stillMissing = requests.filter((request) => resolveFamily(request) === null)
  reportMissingFonts(stillMissing, options)
}

/**
 * Makes the first usable family in a CSS font stack available.
 *
 * Walks the stack in order and stops at the first one that works, so a theme asking for `'Dela Gothic One, Noto Sans JP, sans-serif'` actually gets Dela Gothic One — checking only whether *something* in the stack resolves would silently settle for the fallback that happens to be installed already.
 */
async function ensureStack(request: string, options: object): Promise<void> {
  for (const family of candidateFamilies(request)) {
    if (fonts.has(family)) return
    if (await useFont(family, options)) return
  }
}

/** The named families in a CSS font stack, ignoring the generic keywords. */
function candidateFamilies(request: string): string[] {
  return request
    .split(',')
    .map(unquoteFontFamily)
    .filter((family) => family.length > 0 && !GENERIC_FONT_FAMILIES.has(family))
}

/** A color that may inherit from another when left null. */
function inkFor(color: unknown, inherited: unknown, field: string) {
  return parseColor((color ?? inherited) as never, field)
}

/** Whether anything drawn in this color would be invisible. */
function invisible(color: unknown, field: string): boolean {
  return isTransparent(parseColor(color as never, field))
}

/** The plain text of a run of segments, for coverage probing. */
function plainText(segments: readonly Segment[]): string {
  return segments.map((s) => (s.kind === 'text' ? s.value : '')).join('')
}

/** The first available family in a CSS-style list, or a generic fallback. */
function familyFor(request: string): string {
  return resolveFamily(request) ?? FALLBACK_FAMILY
}

function font(weight: FontWeight, size: number, request: string): string {
  return fontString(weight, size, familyFor(request))
}

/** Draws the quote marks and the quote, returning the y its block ended at. */
function drawQuote(
  ctx: SKRSContext2D,
  segments: readonly Segment[],
  images: EmojiImages,
  theme: Theme,
  layout: Layout,
  options: RenderOptions,
): number {
  const area = layout.text
  const quoted = applyInlineQuotes(segments, theme)

  // A display font with no Japanese coverage would otherwise draw the quote as a row of boxes. Anything it cannot handle falls through to a family that can, while its own glyphs are still used for everything else.
  const stack = coveringStack(theme.text.font, plainText(quoted), DEFAULT_FONT_FAMILIES)

  const result = fitText(quoted, {
    maxWidth: area.width,
    maxHeight: area.height,
    maxFontSize: toPixels(theme.text.size, theme.height),
    minFontSize: toPixels(theme.text.minSize, theme.height),
    lineHeight: theme.text.lineHeight,
    maxLines: theme.text.maxLines,
    overflow: theme.text.overflow,
    phraseBreak: theme.text.phraseBreak,
    locale: theme.text.locale,
    measurerFor: (fontSize) =>
      memoizeMeasurer({
        measureText: (text, style) => {
          const weight = resolvedWeight(theme.text.weight, style?.bold)
          ctx.font = fontString(weight, fontSize, stack, style?.italic ?? false)
          const stroke = syntheticBoldWidth(ctx, weight, stack, fontSize)
          return { width: ctx.measureText(text).width + boldAdvance(stroke) }
        },
      }),
    metricsFor: (fontSize) => ({
      fontSize,
      sideMarginRatio: theme.emoji.sideMarginRatio,
    }),
  })

  const lineStep = result.fontSize * theme.text.lineHeight
  const blockHeight = result.lines.length * lineStep

  // Centre the quote in its area, then let the block marks sit above it.
  let top = area.y + (area.height - blockHeight) / 2
  if (theme.quoteMark.display === 'block') {
    top = drawBlockQuoteMarks(ctx, theme, layout, top)
  }

  ctx.font = fontString(theme.text.weight, result.fontSize, stack)
  ctx.fillStyle = toCSS(parseColor(theme.text.color, 'theme.text.color'))
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  const lineOptions: DrawLineOptions = {
    fontSize: result.fontSize,
    sideMarginRatio: theme.emoji.sideMarginRatio,
    topMarginRatio: theme.emoji.topMarginRatio,
    images,
    onMissing: options.onAssetError ?? 'text',
    baseWeight: theme.text.weight,
    family: stack,
  }

  let y = top + result.fontSize
  for (const line of result.lines) {
    const widths = measureLine(ctx, line, lineOptions)
    const width = widths.reduce((total, w) => total + w, 0)
    drawLine(
      ctx,
      line,
      alignedX(theme.text.align, area.x, area.width, width),
      y,
      lineOptions,
      widths,
    )
    y += lineStep
  }

  return top + blockHeight
}

/**
 * Draws oversized quote marks above the quote.
 *
 * Returns the new top for the quote itself, since the marks push it down.
 */
function drawBlockQuoteMarks(
  ctx: SKRSContext2D,
  theme: Theme,
  layout: Layout,
  top: number,
): number {
  const size = toPixels(theme.quoteMark.size, theme.height)
  const gap = toPixels(theme.quoteMark.gap, theme.height)
  const [open, close] = theme.quoteMark.chars

  ctx.font = font(theme.quoteMark.weight, size, theme.text.font)
  ctx.fillStyle = toCSS(inkFor(theme.quoteMark.color, theme.text.color, 'theme.quoteMark.color'))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  fillText(
    ctx,
    `${open}${close}`,
    layout.centreX,
    top + size * 0.75,
    syntheticBoldWidth(ctx, theme.quoteMark.weight, familyFor(theme.text.font), size),
  )

  return top + size * 0.75 + gap
}

/** Wraps the quote in its marks when they are drawn as running text. */
function applyInlineQuotes(segments: readonly Segment[], theme: Theme): Segment[] {
  if (theme.quoteMark.display !== 'inline') return [...segments]

  const [open, close] = theme.quoteMark.chars
  const out: Segment[] = [...segments]

  const first = out[0]
  if (first?.kind === 'text') {
    out[0] = {
      kind: 'text',
      value: open + first.value,
      ...(first.style ? { style: first.style } : {}),
    }
  } else {
    out.unshift({ kind: 'text', value: open })
  }

  const last = out[out.length - 1]
  if (last?.kind === 'text') {
    out[out.length - 1] = {
      kind: 'text',
      value: last.value + close,
      ...(last.style ? { style: last.style } : {}),
    }
  } else {
    out.push({ kind: 'text', value: close })
  }

  return out
}

/** Draws the rule under the quote, returning the y to continue from. */
function drawDivider(ctx: SKRSContext2D, theme: Theme, layout: Layout, top: number): number {
  if (!theme.divider.enabled) return top

  const gap = toPixels(theme.divider.gap, theme.height)
  const thickness = Math.max(1, toPixels(theme.divider.thickness, theme.height))
  const width = layout.text.width * theme.divider.widthRatio
  const y = top + gap

  ctx.fillStyle = toCSS(inkFor(theme.divider.color, theme.displayName.color, 'theme.divider.color'))
  ctx.fillRect(layout.centreX - width / 2, y, width, thickness)

  return y + thickness + gap
}

/**
 * Draws one centred, prefixed attribution line (display name or username) — both are a `LabelTheme`, styled and positioned identically — and returns the y position its own text baseline landed on, for the next line to stack under.
 */
function drawAttributionLine(
  ctx: SKRSContext2D,
  text: string,
  style: LabelTheme,
  field: string,
  centreX: number,
  y: number,
  height: number,
): number {
  const size = toPixels(style.size, height)
  ctx.font = font(style.weight, size, style.font)
  ctx.fillStyle = toCSS(parseColor(style.color, field))
  const baseline = y + size
  fillText(
    ctx,
    `${style.prefix}${text}`,
    centreX,
    baseline,
    syntheticBoldWidth(ctx, style.weight, familyFor(style.font), size),
  )
  return baseline
}

function drawAttribution(
  ctx: SKRSContext2D,
  data: QuoteData,
  theme: Theme,
  layout: Layout,
  top: number,
): void {
  let y = top + theme.height * (theme.divider.enabled ? 0.012 : 0.055)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  const displayName = effectiveDisplayName(data)
  if (displayName && !invisible(theme.displayName.color, 'theme.displayName.color')) {
    y = drawAttributionLine(
      ctx,
      displayName,
      theme.displayName,
      'theme.displayName.color',
      layout.centreX,
      y,
      theme.height,
    )
    y += theme.height * 0.012
  }

  if (data.username && !invisible(theme.username.color, 'theme.username.color')) {
    drawAttributionLine(
      ctx,
      data.username,
      theme.username,
      'theme.username.color',
      layout.centreX,
      y,
      theme.height,
    )
  }
}

function drawWatermark(
  ctx: SKRSContext2D,
  data: QuoteData,
  theme: Theme,
  image: Image | null,
): void {
  if (image) {
    drawWatermarkImage(ctx, image, theme)
    return
  }

  if (!data.watermark) return
  if (invisible(theme.watermark.color, 'theme.watermark.color')) return

  const size = toPixels(theme.watermark.size, theme.height)
  const marginX = toPixels(theme.watermark.margin, theme.width)
  const marginY = toPixels(theme.watermark.margin, theme.height)

  ctx.font = font(theme.watermark.weight, size, theme.watermark.font)
  ctx.fillStyle = toCSS(parseColor(theme.watermark.color, 'theme.watermark.color'))
  ctx.textBaseline = 'alphabetic'

  const stroke = syntheticBoldWidth(
    ctx,
    theme.watermark.weight,
    familyFor(theme.watermark.font),
    size,
  )
  const y = theme.height - marginY
  const corner = watermarkCorner(theme)

  if (corner === 'bottom-left') {
    ctx.textAlign = 'left'
    fillText(ctx, data.watermark, marginX, y, stroke)
  } else if (corner === 'bottom-center') {
    ctx.textAlign = 'center'
    fillText(ctx, data.watermark, theme.width / 2, y, stroke)
  } else {
    ctx.textAlign = 'right'
    fillText(ctx, data.watermark, theme.width - marginX, y, stroke)
  }
}

/**
 * Draws a watermark image at the same corner the text watermark would use. Its height comes from `theme.watermark.imageSize` when set (`size` is tuned for a short text tag and reads small for a logo), falling back to `size` so the two forms share one scale until told otherwise; width follows from the image's own aspect ratio. `color`/`font`/`weight` don't apply to an image and are ignored.
 */
function drawWatermarkImage(ctx: SKRSContext2D, image: Image, theme: Theme): void {
  const height = toPixels(theme.watermark.imageSize ?? theme.watermark.size, theme.height)
  const width = height * (image.width / Math.max(1, image.height))
  const marginX = toPixels(theme.watermark.margin, theme.width)
  const marginY = toPixels(theme.watermark.margin, theme.height)
  const y = theme.height - marginY - height
  const corner = watermarkCorner(theme)

  const x =
    corner === 'bottom-left'
      ? marginX
      : corner === 'bottom-center'
        ? (theme.width - width) / 2
        : theme.width - marginX - width

  ctx.drawImage(image, x, y, width, height)
}

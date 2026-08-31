import { stripMarkdown } from '../text/markdown'
import { ValidationError } from './errors'
import type { AvatarSource, MarkdownMode, QuoteData, QuoteInput, RenderMarkdownMode } from './types'

export const MAX_TEXT_LENGTH = 4000
export const MAX_NAME_LENGTH = 128
export const MAX_WATERMARK_LENGTH = 64

export function emptyQuote(): QuoteData {
  return {
    text: '',
    avatar: null,
    username: '',
    displayName: '',
    watermark: '',
    watermarkImage: null,
    markdown: 'raw',
  }
}

/**
 * Picks the effective `MarkdownMode` from most to least specific, stopping at
 * the first one actually set: an explicit per-call option, then whatever else
 * is offered (a legacy boolean translated to its equivalent mode, a global
 * `MiQOptions.markdown` default, …), finally falling back to the value that
 * preserves each source's historical behaviour.
 */
export function resolveMarkdownMode(
  candidates: ReadonlyArray<MarkdownMode | undefined>,
  fallback: MarkdownMode,
): MarkdownMode {
  for (const candidate of candidates) {
    if (candidate !== undefined) return candidate
  }
  return fallback
}

/**
 * Translates a legacy `stripDiscordMarkdown`/`stripMfm` boolean into the
 * equivalent `MarkdownMode` — both booleans mean "strip" when true, "quote
 * exactly as written" when false. `undefined` (not set) stays `undefined` so
 * it defers to the next fallback instead of pinning `'raw'`.
 */
export function translateLegacyStrip(flag: boolean | undefined): MarkdownMode | undefined {
  if (flag === undefined) return undefined
  return flag ? false : 'raw'
}

/**
 * Resolves what `QuoteData.text`/`.markdown` should actually store for a
 * given `MarkdownMode`.
 *
 * `false` is handled right here: the caller's dialect-appropriate parser
 * strips the text immediately (same timing as today's
 * `stripDiscordMarkdown()`/`stripMfm()`), and `'raw'` is what survives into
 * `QuoteData.markdown` — the dialect that would have stripped it is not
 * needed past this point. Every other mode passes `text` through untouched,
 * deferring the actual parse to render time.
 */
export function resolveQuoteText(
  text: string,
  mode: MarkdownMode,
  stripWithDialect: () => string,
): { text: string; markdown: RenderMarkdownMode } {
  if (mode === false) return { text: stripWithDialect(), markdown: 'raw' }
  return { text, markdown: mode }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string, received ${typeof value}`, { field })
  }
}

function assertLength(value: string, max: number, field: string) {
  if (value.length > max) {
    throw new ValidationError(
      `${field} must be at most ${max} characters, received ${value.length}`,
      {
        field,
      },
    )
  }
}

export function normalizeText(text: unknown): string {
  assertString(text, 'text')
  assertLength(text, MAX_TEXT_LENGTH, 'text')
  return text
}

export function normalizeUsername(username: unknown): string {
  assertString(username, 'username')
  assertLength(username, MAX_NAME_LENGTH, 'username')
  return username
}

export function normalizeDisplayName(displayName: unknown): string {
  assertString(displayName, 'displayName')
  assertLength(displayName, MAX_NAME_LENGTH, 'displayName')
  return displayName
}

export function normalizeWatermark(watermark: unknown): string {
  assertString(watermark, 'watermark')
  assertLength(watermark, MAX_WATERMARK_LENGTH, 'watermark')
  return watermark
}

export function normalizeAvatar(avatar: unknown): AvatarSource | null {
  if (avatar === null || avatar === undefined) return null
  if (typeof avatar === 'string') return avatar
  if (avatar instanceof URL) return avatar
  if (avatar instanceof Uint8Array) return avatar
  throw new ValidationError('avatar must be a string, URL, Buffer, Uint8Array or null', {
    field: 'avatar',
  })
}

/**
 * Splits a `watermark` input into its text/image halves — the two are
 * mutually exclusive, unlike `avatar` where a string is itself an image
 * source. Here a string is a text label; only a URL/Buffer/Uint8Array means
 * an image.
 */
export function normalizeWatermarkInput(value: unknown): {
  watermark: string
  watermarkImage: AvatarSource | null
} {
  if (value === null) return { watermark: '', watermarkImage: null }
  if (typeof value === 'string')
    return { watermark: normalizeWatermark(value), watermarkImage: null }
  if (value instanceof URL || value instanceof Uint8Array) {
    return { watermark: '', watermarkImage: value }
  }
  throw new ValidationError('watermark must be a string, URL, Buffer, Uint8Array or null', {
    field: 'watermark',
  })
}

/**
 * Applies a partial input onto a quote, validating each provided field.
 *
 * Absent keys are left untouched; `undefined` is treated as absent so that
 * spreading a partially-filled object behaves the way it reads.
 */
export function applyInput(
  target: QuoteData,
  input: QuoteInput,
  globalMarkdown?: MarkdownMode,
): QuoteData {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('setFromObject expects an object', { field: 'input' })
  }

  const next: QuoteData = { ...target }

  if (input.text !== undefined) next.text = normalizeText(input.text)

  const mode = input.markdown ?? globalMarkdown
  if (mode !== undefined) {
    const resolved = resolveQuoteText(next.text, mode, () => stripMarkdown(next.text))
    next.text = resolved.text
    next.markdown = resolved.markdown
  }
  if (input.avatar !== undefined) next.avatar = normalizeAvatar(input.avatar)
  if (input.username !== undefined) next.username = normalizeUsername(input.username)
  if (input.displayName !== undefined) next.displayName = normalizeDisplayName(input.displayName)
  if (input.watermark !== undefined) {
    const resolved = normalizeWatermarkInput(input.watermark)
    next.watermark = resolved.watermark
    next.watermarkImage = resolved.watermarkImage
  }

  return next
}

/**
 * Final check before rendering or sending.
 *
 * `text` is the only truly required field — a quote with no words is not a
 * quote, while a missing avatar or name just renders as less.
 */
export function assertRenderable(data: QuoteData): void {
  if (data.text.trim().length === 0) {
    throw new ValidationError('text is required', { field: 'text' })
  }
}

/**
 * The display name to draw, falling back to the username so the attribution
 * line is never empty when only one of them was set.
 */
export function effectiveDisplayName(data: QuoteData): string {
  return data.displayName || data.username
}

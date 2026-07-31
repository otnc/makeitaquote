import { ValidationError } from './errors'
import type { AvatarSource, QuoteData, QuoteInput } from './types'

export const MAX_TEXT_LENGTH = 4000
export const MAX_NAME_LENGTH = 128
export const MAX_WATERMARK_LENGTH = 64

export function emptyQuote(): QuoteData {
  return { text: '', avatar: null, username: '', displayName: '', watermark: '' }
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
 * Applies a partial input onto a quote, validating each provided field.
 *
 * Absent keys are left untouched; `undefined` is treated as absent so that
 * spreading a partially-filled object behaves the way it reads.
 */
export function applyInput(target: QuoteData, input: QuoteInput): QuoteData {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('setFromObject expects an object', { field: 'input' })
  }

  const next: QuoteData = { ...target }

  if (input.text !== undefined) next.text = normalizeText(input.text)
  if (input.avatar !== undefined) next.avatar = normalizeAvatar(input.avatar)
  if (input.username !== undefined) next.username = normalizeUsername(input.username)
  if (input.displayName !== undefined) next.displayName = normalizeDisplayName(input.displayName)
  if (input.watermark !== undefined) next.watermark = normalizeWatermark(input.watermark)

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

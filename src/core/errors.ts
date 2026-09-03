import type { MiQErrorOptions } from '@makeitaquote/utils/errors'
import { MiQError } from '@makeitaquote/utils/errors'

export type { MiQErrorOptions, ValidationErrorOptions } from '@makeitaquote/utils/errors'
export { MiQError, ValidationError } from '@makeitaquote/utils/errors'

export interface FontNotAvailableErrorOptions extends MiQErrorOptions {
  family?: string
}

/**
 * A requested font family could not be resolved.
 *
 * Only thrown when `strictFonts` is enabled — by default a missing font is a warning and rendering falls back to whatever the system provides.
 */
export class FontNotAvailableError extends MiQError {
  readonly family: string | undefined

  constructor(message: string, options?: FontNotAvailableErrorOptions) {
    super(message, options)
    this.name = 'FontNotAvailableError'
    this.family = options?.family
  }
}

export type AssetKind = 'avatar' | 'emoji' | 'font'

export interface AssetFetchErrorOptions extends MiQErrorOptions {
  url?: string
  kind?: AssetKind
  status?: number
}

/** An avatar, emoji image or font file could not be fetched. */
export class AssetFetchError extends MiQError {
  readonly url: string | undefined
  readonly kind: AssetKind | undefined
  readonly status: number | undefined

  constructor(message: string, options?: AssetFetchErrorOptions) {
    super(message, options)
    this.name = 'AssetFetchError'
    this.url = options?.url
    this.kind = options?.kind
    this.status = options?.status
  }
}

/** Drawing failed, including text that could not be made to fit. */
export class RenderError extends MiQError {
  constructor(message: string, options?: MiQErrorOptions) {
    super(message, options)
    this.name = 'RenderError'
  }
}

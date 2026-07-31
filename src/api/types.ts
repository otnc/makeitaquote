import { MiQError, type MiQErrorOptions } from '../core/errors'
import type { QuoteData } from '../core/types'
import type { EndpointPath } from './endpoints'

export interface VoidsQuoteData extends QuoteData {
  /** Keeps the avatar in colour. Sent verbatim to the API. */
  color: boolean
}

export interface VoidsOptions {
  baseUrl?: string
  /** Request timeout in ms, default 15000. */
  timeout?: number
  /** Retry attempts for transient failures, default 2. */
  retry?: number
  headers?: Record<string, string>
  signal?: AbortSignal
}

/** The wire format the API expects — snake_case, and `avatar` must be a URL. */
export interface VoidsPayload {
  text: string
  avatar: string | null
  username: string
  display_name: string
  color: boolean
  watermark: string
}

export interface VoidsApiErrorOptions extends MiQErrorOptions {
  status?: number
  body?: unknown
  endpoint: EndpointPath
}

/** The Voids API refused or failed a request. */
export class VoidsApiError extends MiQError {
  readonly status: number | undefined
  readonly body: unknown
  readonly endpoint: EndpointPath

  constructor(message: string, options: VoidsApiErrorOptions) {
    super(message, options)
    this.name = 'VoidsApiError'
    this.status = options.status
    this.body = options.body
    this.endpoint = options.endpoint
  }
}

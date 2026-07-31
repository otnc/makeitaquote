import { HTTPError, type KyInstance, TimeoutError } from 'ky'
import { ValidationError } from '../core/errors'
import {
  applyInput,
  assertRenderable,
  emptyQuote,
  normalizeAvatar,
  normalizeDisplayName,
  normalizeText,
  normalizeUsername,
  normalizeWatermark,
} from '../core/quote'
import { fromMessage } from '../core/source'
import type { MessageLike, MessageSourceOptions, QuoteInput } from '../core/types'
import { captureErrorBody, createClient, type ErrorBodyCapture } from '../http/client'
import { DEFAULT_BASE_URL, type EndpointPath, endpoints } from './endpoints'
import { VoidsApiError, type VoidsOptions, type VoidsPayload, type VoidsQuoteData } from './types'

function emptyVoidsQuote(): VoidsQuoteData {
  return { ...emptyQuote(), color: false }
}

/**
 * Builds a quote through the Voids API instead of rendering it here.
 *
 * Pick a method by what you want back:
 *
 * ```ts
 * await new VoidsMiQ().setText('hi').toURL()     // hosted image URL
 * await new VoidsMiQ().setText('hi').toBuffer()  // the PNG bytes
 * ```
 *
 * Note that the API is operated by a third party, not by this package.
 */
export class VoidsMiQ {
  #data: VoidsQuoteData = emptyVoidsQuote()
  #http: KyInstance
  #baseUrl: string
  #signal: AbortSignal | undefined

  constructor(options: VoidsOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.#signal = options.signal
    this.#http = createClient({
      timeout: options.timeout ?? 15_000,
      retry: options.retry ?? 2,
      ...(options.headers ? { headers: options.headers } : {}),
    })
  }

  setText(text: string): this {
    this.#data.text = normalizeText(text)
    return this
  }

  /** The API only takes a URL, so buffers are rejected here. */
  setAvatar(avatar: string | URL | null): this {
    const normalized = normalizeAvatar(avatar)
    if (normalized !== null && typeof normalized !== 'string' && !(normalized instanceof URL)) {
      throw new ValidationError('The Voids API only accepts an avatar URL, not image data', {
        field: 'avatar',
      })
    }
    this.#data.avatar = normalized
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

  setColor(color = true): this {
    if (typeof color !== 'boolean') {
      throw new ValidationError('color must be a boolean', { field: 'color' })
    }
    this.#data.color = color
    return this
  }

  setWatermark(watermark: string): this {
    this.#data.watermark = normalizeWatermark(watermark)
    return this
  }

  setFromMessage(message: MessageLike, options?: MessageSourceOptions): this {
    const { color } = this.#data
    this.#data = { ...fromMessage(message, options), color }
    return this
  }

  setFromObject(input: QuoteInput): this {
    const merged = applyInput(this.#data, input)
    this.#data = { ...merged, color: input.color ?? this.#data.color }
    return this
  }

  getData(): Readonly<VoidsQuoteData> {
    return { ...this.#data }
  }

  clone(): VoidsMiQ {
    const copy = new VoidsMiQ({ baseUrl: this.#baseUrl })
    copy.#data = { ...this.#data }
    copy.#http = this.#http
    copy.#signal = this.#signal
    return copy
  }

  /**
   * Renders the quote and returns the URL the API hosts it at.
   *
   * Always goes through `/fakequote` — it is the only endpoint that returns a
   * URL. The image is uploaded to the API's storage as a side effect.
   */
  async toURL(): Promise<string> {
    assertRenderable(this.#data)

    const body = await this.#post(endpoints.hosted.path)
    let parsed: unknown
    try {
      parsed = await body.json()
    } catch (cause) {
      throw new VoidsApiError('The API did not return JSON', {
        endpoint: endpoints.hosted.path,
        cause,
      })
    }

    const url = (parsed as { url?: unknown } | null)?.url
    if (typeof url !== 'string' || url.length === 0) {
      throw new VoidsApiError('The API response did not contain a url', {
        endpoint: endpoints.hosted.path,
        body: parsed,
      })
    }
    return url
  }

  /**
   * Renders the quote and returns the image bytes.
   *
   * Uses `/fakequotebeta` by default: one round trip, and the image is never
   * stored anywhere. Pass `{ hosted: true }` to go through `/fakequote`
   * instead, which uploads the image and then downloads it back.
   */
  async toBuffer(options: { hosted?: boolean } = {}): Promise<Buffer> {
    assertRenderable(this.#data)

    if (options.hosted) {
      const url = await this.toURL()
      const capture = captureErrorBody()
      try {
        const response = await this.#http.get(url, {
          ...this.#requestOptions(),
          hooks: capture.hooks,
        })
        return Buffer.from(await response.arrayBuffer())
      } catch (cause) {
        throw toApiError(
          cause,
          endpoints.hosted.path,
          'Failed to download the hosted image',
          capture,
        )
      }
    }

    const response = await this.#post(endpoints.direct.path)
    return Buffer.from(await response.arrayBuffer())
  }

  async #post(path: EndpointPath): Promise<Response> {
    const capture = captureErrorBody()
    try {
      return await this.#http.post(`${this.#baseUrl}${path}`, {
        json: toPayload(this.#data),
        ...this.#requestOptions(),
        hooks: capture.hooks,
      })
    } catch (cause) {
      throw toApiError(cause, path, 'Failed to generate quote', capture)
    }
  }

  #requestOptions() {
    return this.#signal ? { signal: this.#signal } : {}
  }
}

/** Alias so `import { MiQ } from 'makeitaquote/api'` reads naturally. */
export { VoidsMiQ as MiQ }

export function toPayload(data: VoidsQuoteData): VoidsPayload {
  return {
    text: data.text,
    avatar: data.avatar === null ? null : String(data.avatar),
    username: data.username,
    display_name: data.displayName,
    color: data.color,
    watermark: data.watermark,
  }
}

/**
 * Turns whatever ky threw into a `VoidsApiError`, keeping the response body
 * when there is one — the API puts its reason in there.
 */
function toApiError(
  cause: unknown,
  endpoint: EndpointPath,
  prefix: string,
  capture: ErrorBodyCapture,
): VoidsApiError {
  if (cause instanceof HTTPError) {
    return new VoidsApiError(`${prefix}: HTTP ${cause.response.status}`, {
      endpoint,
      status: cause.response.status,
      body: capture.body,
      cause,
    })
  }

  if (cause instanceof TimeoutError) {
    return new VoidsApiError(`${prefix}: request timed out`, { endpoint, cause })
  }

  const message = cause instanceof Error ? cause.message : String(cause)
  return new VoidsApiError(`${prefix}: ${message}`, { endpoint, cause })
}

import { FetchError, ofetch } from 'ofetch'

export interface HttpOptions {
  timeout?: number
  retry?: number
  headers?: Record<string, string>
}

export interface RequestOptions {
  signal?: AbortSignal
  /** Default true. `false` resolves with the response instead of throwing on a non-2xx status. */
  throwHttpErrors?: boolean
  /** Serialized as the request body. */
  json?: unknown
}

export interface HttpClient {
  get(url: string, options?: RequestOptions): Promise<Response>
  post(url: string, options?: RequestOptions): Promise<Response>
}

/** Thrown for a non-2xx response, same shape callers relied on from ky. */
export class HTTPError extends Error {
  readonly response: Response
  /** The body, already read — the response above is a fresh one built from it, not the original stream. */
  readonly body: string

  constructor(response: Response, body: string) {
    super(`Request failed with status code ${response.status}`)
    this.name = 'HTTPError'
    this.response = response
    this.body = body
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('Request timed out')
    this.name = 'TimeoutError'
  }
}

/**
 * Shared `ofetch` factory.
 *
 * Callers create their own instance rather than sharing one, because the
 * sensible timeout for a 64px emoji, a 9MB font and a quote-rendering API call
 * are three different numbers.
 */
export function createClient(options: HttpOptions = {}): HttpClient {
  const instance = ofetch.create({
    timeout: options.timeout ?? 10_000,
    retry: options.retry ?? 2,
    retryStatusCodes: [408, 413, 429, 500, 502, 503, 504],
    // ofetch's `retryDelay` gets no attempt count to grow with (unlike ky's
    // exponential `backoffLimit`), so this is a flat delay rather than a
    // growing one — untested either way, and a couple of quick retries is
    // still better than none.
    retryDelay: 300,
    headers: options.headers,
  })

  async function request(
    method: 'GET' | 'POST',
    url: string,
    options: RequestOptions,
  ): Promise<Response> {
    const throwHttpErrors = options.throwHttpErrors !== false

    try {
      const raw = await instance.raw(url, {
        method,
        body: options.json as Record<string, unknown> | undefined,
        signal: options.signal,
        // Fetched as bytes regardless of content type, then rebuilt into a
        // real `Response` below — `ofetch` otherwise consumes the body to
        // populate its own parsed `.data`, leaving nothing for a caller to
        // read `.arrayBuffer()`/`.text()`/`.json()` off of afterwards.
        responseType: 'arrayBuffer',
        // Retrying only happens on the throwing path — see the `catch`
        // below — so a caller opting out of the throw also opts out of the
        // retry. Undocumented either way in the old ky-based behaviour.
        ignoreResponseError: !throwHttpErrors,
      })
      return toResponse(raw.status, raw.statusText, raw.headers, raw._data as ArrayBuffer)
    } catch (cause) {
      if (isTimeout(cause)) throw new TimeoutError()
      if (cause instanceof FetchError && cause.response) {
        const body = cause.data as ArrayBuffer
        throw new HTTPError(
          toResponse(
            cause.response.status,
            cause.response.statusText,
            cause.response.headers,
            body,
          ),
          new TextDecoder().decode(body),
        )
      }
      throw cause
    }
  }

  return {
    get: (url, options = {}) => request('GET', url, options),
    post: (url, options = {}) => request('POST', url, options),
  }
}

function toResponse(
  status: number,
  statusText: string,
  headers: Headers,
  body: ArrayBuffer,
): Response {
  return new Response(body, { status, statusText, headers })
}

/** `ofetch` wraps `fetch`'s own abort-on-timeout error rather than raising its own type. */
function isTimeout(cause: unknown): boolean {
  return (
    cause instanceof FetchError &&
    cause.cause instanceof Error &&
    cause.cause.name === 'TimeoutError'
  )
}

import ky, { type KyInstance, type Options } from 'ky'

export interface HttpOptions {
  timeout?: number
  retry?: number
  headers?: Record<string, string>
  signal?: AbortSignal
}

export interface ErrorBodyCapture {
  /** Spread into a request so the hook runs for it. */
  hooks: Options['hooks']
  /** The failed response body, once there has been one. */
  body: string | undefined
}

/**
 * Captures the body of a failed response so it can be reported later.
 *
 * ky reads the body while building an `HTTPError`, and the response attached to
 * that error is not the same object the hook saw — so the text has to be
 * carried out through a closure rather than looked up from the error.
 */
export function captureErrorBody(): ErrorBodyCapture {
  const capture: ErrorBodyCapture = {
    body: undefined,
    hooks: {
      afterResponse: [
        async ({ response }) => {
          if (response.ok) return undefined
          try {
            capture.body = await response.clone().text()
          } catch {
            // Unreadable body; the error will just carry the status.
          }
          return undefined
        },
      ],
    },
  }
  return capture
}

/**
 * Shared ky factory.
 *
 * Callers create their own instance rather than sharing one, because the
 * sensible timeout for a 64px emoji, a 9MB font and a quote-rendering API call
 * are three different numbers.
 */
export function createClient(options: HttpOptions = {}): KyInstance {
  return ky.create({
    timeout: options.timeout ?? 10_000,
    retry: {
      limit: options.retry ?? 2,
      methods: ['get', 'post'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      backoffLimit: 3_000,
    },
    headers: options.headers,
  })
}

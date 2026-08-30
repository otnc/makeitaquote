import { afterEach, describe, expect, it, vi } from 'vitest'
import { createClient, HTTPError, TimeoutError } from './client'

/** A fetch stub that respects an AbortSignal, the way a real fetch would. */
function hangingFetch(): typeof fetch {
  return ((_input: unknown, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      const signal = init?.signal
      if (!signal) return
      if (signal.aborted) {
        reject(signal.reason)
        return
      }
      signal.addEventListener('abort', () => reject(signal.reason))
    })
  }) as typeof fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createClient', () => {
  it('GETs and returns a Response with the body intact', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response('hello', { status: 200, headers: { 'content-type': 'text/plain' } }),
    )
    const client = createClient()

    const response = await client.get('https://example.test/')

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('hello')
  })

  it('HEADs without downloading the body', async () => {
    let seenMethod: string | undefined
    vi.stubGlobal('fetch', async (_input: unknown, init?: RequestInit) => {
      seenMethod = init?.method
      return new Response('', { status: 200 })
    })
    const client = createClient()

    const response = await client.head('https://example.test/')

    expect(seenMethod).toBe('HEAD')
    expect(response.status).toBe(200)
  })

  it('throws HTTPError for a non-2xx status by default', async () => {
    vi.stubGlobal('fetch', async () => new Response('not found', { status: 404 }))
    const client = createClient({ retry: 0 })

    const error = await client.get('https://example.test/').catch((cause) => cause)

    expect(error).toBeInstanceOf(HTTPError)
    expect(error.response.status).toBe(404)
    expect(error.body).toBe('not found')
  })

  it('resolves with the response instead of throwing when throwHttpErrors is false', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 404 }))
    const client = createClient({ retry: 0 })

    const response = await client.get('https://example.test/', { throwHttpErrors: false })

    expect(response.status).toBe(404)
  })

  it('retries a retryable status code and returns the eventual success', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls++
      if (calls < 3) return new Response('', { status: 503 })
      return new Response('ok', { status: 200 })
    })
    const client = createClient({ retry: 2 })

    const response = await client.get('https://example.test/')

    expect(calls).toBe(3)
    expect(response.status).toBe(200)
  })

  it('stops retrying once the budget runs out and throws the last failure', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls++
      return new Response('', { status: 503 })
    })
    const client = createClient({ retry: 2 })

    const error = await client.get('https://example.test/').catch((cause) => cause)

    // The first attempt plus 2 retries, then it gives up.
    expect(calls).toBe(3)
    expect(error).toBeInstanceOf(HTTPError)
    expect(error.response.status).toBe(503)
  })

  it('does not retry a non-retryable status code', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls++
      return new Response('', { status: 404 })
    })
    const client = createClient({ retry: 2 })

    await expect(client.get('https://example.test/')).rejects.toThrow(HTTPError)
    expect(calls).toBe(1)
  })

  it('throws TimeoutError when the request exceeds its timeout', async () => {
    vi.stubGlobal('fetch', hangingFetch())
    const client = createClient({ timeout: 20, retry: 0 })

    await expect(client.get('https://example.test/')).rejects.toThrow(TimeoutError)
  })

  it('getBuffer reads the response body into a Buffer', async () => {
    vi.stubGlobal('fetch', async () => new Response('hello', { status: 200 }))
    const client = createClient()

    const buffer = await client.getBuffer('https://example.test/')

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.toString()).toBe('hello')
  })
})

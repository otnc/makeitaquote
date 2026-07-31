import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { v14Message } from '../__fixtures__/messages'
import { ValidationError } from '../core/errors'
import { toPayload, VoidsMiQ } from './client'
import { VoidsApiError } from './types'

interface Call {
  url: string
  method: string
  body: unknown
}

let calls: Call[] = []

/**
 * Stubs `fetch` rather than ky itself, so the retry, timeout and error-mapping
 * behaviour under test is the real thing.
 *
 * ky calls `fetch(request)` with a `Request`, so the method and body have to be
 * read off that rather than off an init object.
 */
function stubFetch(handler: (url: string, request: Request) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const raw = await request.clone().text()
    let body: unknown
    if (raw.length > 0) {
      try {
        body = JSON.parse(raw)
      } catch {
        body = raw
      }
    }
    calls.push({ url: request.url, method: request.method.toUpperCase(), body })
    return handler(request.url, request)
  })
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function imageResponse() {
  return new Response(png, { status: 200, headers: { 'content-type': 'image/png' } })
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function quote() {
  return new VoidsMiQ({ retry: 0 }).setText('Hello World!').setUsername('otoneko.')
}

beforeEach(() => {
  calls = []
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('endpoint selection', () => {
  it('uses /fakequote for toURL', async () => {
    stubFetch(() => jsonResponse({ url: 'https://cdn.voids.top/q.png' }))

    const url = await quote().toURL()

    expect(url).toBe('https://cdn.voids.top/q.png')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://api.voids.top/fakequote')
    expect(calls[0]?.method).toBe('POST')
  })

  it('uses /fakequotebeta for toBuffer, in a single round trip', async () => {
    stubFetch(() => imageResponse())

    const buffer = await quote().toBuffer()

    expect(buffer).toEqual(Buffer.from(png))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://api.voids.top/fakequotebeta')
  })

  it('takes two round trips through /fakequote when hosted is requested', async () => {
    stubFetch((url) =>
      url.endsWith('/fakequote')
        ? jsonResponse({ url: 'https://cdn.voids.top/q.png' })
        : imageResponse(),
    )

    const buffer = await quote().toBuffer({ hosted: true })

    expect(buffer).toEqual(Buffer.from(png))
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.voids.top/fakequote',
      'https://cdn.voids.top/q.png',
    ])
  })

  it('honours a custom baseUrl and trims its trailing slash', async () => {
    stubFetch(() => imageResponse())

    await new VoidsMiQ({ baseUrl: 'https://mirror.test/', retry: 0 }).setText('hi').toBuffer()

    expect(calls[0]?.url).toBe('https://mirror.test/fakequotebeta')
  })
})

describe('payload', () => {
  it('sends snake_case keys', async () => {
    stubFetch(() => imageResponse())

    await new VoidsMiQ({ retry: 0 })
      .setText('Hello World!')
      .setAvatar('https://example.test/a.png')
      .setUsername('otoneko.')
      .setDisplayName('音猫｡')
      .setColor(true)
      .setWatermark('Make it a Quote')
      .toBuffer()

    expect(calls[0]?.body).toEqual({
      text: 'Hello World!',
      avatar: 'https://example.test/a.png',
      username: 'otoneko.',
      display_name: '音猫｡',
      color: true,
      watermark: 'Make it a Quote',
    })
  })

  it('serializes a URL avatar to a string', () => {
    const data = new VoidsMiQ()
      .setText('hi')
      .setAvatar(new URL('https://example.test/a.png'))
      .getData()

    expect(toPayload(data).avatar).toBe('https://example.test/a.png')
  })

  it('sends null when there is no avatar', () => {
    expect(toPayload(new VoidsMiQ().setText('hi').getData()).avatar).toBeNull()
  })
})

describe('input', () => {
  it('builds from a Discord message and keeps the color flag', () => {
    const data = new VoidsMiQ().setColor(true).setFromMessage(v14Message()).getData()

    expect(data.text).toBe('Hello World!')
    expect(data.displayName).toBe('ねこ')
    expect(data.color).toBe(true)
  })

  it('merges partial objects', () => {
    const data = new VoidsMiQ()
      .setText('first')
      .setFromObject({ username: 'otoneko.', color: true })
      .getData()

    expect(data).toMatchObject({ text: 'first', username: 'otoneko.', color: true })
  })

  it('rejects image data as an avatar', () => {
    expect(() => new VoidsMiQ().setAvatar(Buffer.from(png) as unknown as string)).toThrow(
      ValidationError,
    )
  })

  it('requires text before sending', async () => {
    stubFetch(() => imageResponse())

    await expect(new VoidsMiQ().toBuffer()).rejects.toThrow(ValidationError)
    expect(calls).toHaveLength(0)
  })

  it('clone does not share state with the original', () => {
    const original = new VoidsMiQ().setText('first')
    const copy = original.clone().setText('second')

    expect(original.getData().text).toBe('first')
    expect(copy.getData().text).toBe('second')
  })
})

describe('errors', () => {
  it('maps an HTTP failure onto VoidsApiError with the status and body', async () => {
    stubFetch(() => jsonResponse({ message: 'nope' }, 503))

    const error = await quote()
      .toBuffer()
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(VoidsApiError)
    expect((error as VoidsApiError).status).toBe(503)
    expect((error as VoidsApiError).endpoint).toBe('/fakequotebeta')
    expect((error as VoidsApiError).body).toContain('nope')
  })

  it('reports which endpoint failed', async () => {
    stubFetch(() => jsonResponse({}, 500))

    const error = await quote()
      .toURL()
      .catch((e: unknown) => e)

    expect((error as VoidsApiError).endpoint).toBe('/fakequote')
  })

  it('fails when the hosted endpoint answers without a url', async () => {
    stubFetch(() => jsonResponse({ ok: true }))

    await expect(quote().toURL()).rejects.toThrow(VoidsApiError)
  })

  it('fails when the hosted endpoint does not answer with JSON', async () => {
    stubFetch(() => new Response('<html>oops</html>', { status: 200 }))

    await expect(quote().toURL()).rejects.toThrow(VoidsApiError)
  })

  it('wraps network failures', async () => {
    stubFetch(() => {
      throw new TypeError('fetch failed')
    })

    await expect(quote().toBuffer()).rejects.toThrow(VoidsApiError)
  })
})

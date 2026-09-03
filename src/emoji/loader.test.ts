import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Segment } from '../core/types'
import { segmentText } from '../text/segment'
import { clearEmojiCache, configureEmojiCache, emojiCacheInfo } from './cache'
import { type ImageFetcher, loadEmoji, prefetchEmoji } from './loader'

/** A 1x1 transparent PNG — the smallest thing @napi-rs/canvas will decode. */
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

function countingFetcher(): ImageFetcher & { calls: string[] } {
  const calls: string[] = []
  const fetcher = (async (url: string) => {
    calls.push(url)
    return pixel
  }) as ImageFetcher & { calls: string[] }
  fetcher.calls = calls
  return fetcher
}

afterEach(() => {
  configureEmojiCache({})
  clearEmojiCache()
})

describe('the local Twemoji store', () => {
  it('serves an installed image without touching the network', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'miq-twemoji-loader-'))
    // A codepoint the CDN does not have, so only the local file can answer.
    await writeFile(join(dir, 'fffef.png'), pixel)
    vi.stubEnv('MIQ_TWEMOJI_CACHE_DIR', dir)
    // If the wiring broke, the fetch stub turns the CDN attempt into a failure rather than real network traffic.
    vi.stubGlobal('fetch', async () => {
      throw new Error('should not be called')
    })

    try {
      const image = await loadEmoji(
        'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/fffef.png',
      )

      expect(image?.width).toBe(1)
    } finally {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('loadEmoji', () => {
  it('fetches and decodes an image', async () => {
    const image = await loadEmoji('https://cdn.test/a.png', { fetcher: countingFetcher() })

    expect(image).not.toBeNull()
    expect(image?.width).toBe(1)
  })

  it('serves the second call from cache', async () => {
    const fetcher = countingFetcher()

    await loadEmoji('https://cdn.test/a.png', { fetcher })
    await loadEmoji('https://cdn.test/a.png', { fetcher })

    expect(fetcher.calls).toEqual(['https://cdn.test/a.png'])
  })

  it('coalesces concurrent requests for the same url', async () => {
    let resolve: (value: Buffer) => void = () => {}
    const calls: string[] = []
    const fetcher: ImageFetcher = async (url) => {
      calls.push(url)
      return new Promise<Buffer>((r) => {
        resolve = r
      })
    }

    const both = Promise.all([
      loadEmoji('https://cdn.test/a.png', { fetcher }),
      loadEmoji('https://cdn.test/a.png', { fetcher }),
    ])
    resolve(pixel)
    const [first, second] = await both

    expect(calls).toHaveLength(1)
    expect(first).toBe(second)
  })

  it('returns null instead of throwing when the fetch fails', async () => {
    const image = await loadEmoji('https://cdn.test/missing.png', {
      fetcher: async () => {
        throw new Error('404')
      },
    })

    expect(image).toBeNull()
  })

  it('returns null instead of throwing when the bytes are not an image', async () => {
    const image = await loadEmoji('https://cdn.test/bad.png', {
      fetcher: async () => Buffer.from('not an image'),
    })

    expect(image).toBeNull()
  })

  it('remembers a failure so it is not retried immediately', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('boom')
    })

    await loadEmoji('https://cdn.test/x.png', { fetcher })
    await loadEmoji('https://cdn.test/x.png', { fetcher })

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(emojiCacheInfo().failures).toBe(1)
  })

  it('always refetches once caching is disabled', async () => {
    configureEmojiCache({ enabled: false })
    const fetcher = countingFetcher()

    await loadEmoji('https://cdn.test/a.png', { fetcher })
    await loadEmoji('https://cdn.test/a.png', { fetcher })

    expect(fetcher.calls).toHaveLength(2)
  })
})

describe('prefetchEmoji', () => {
  it('returns an empty map when there is no emoji', async () => {
    const images = await prefetchEmoji(segmentText('plain text'))

    expect(images.size).toBe(0)
  })

  it('loads every distinct emoji once', async () => {
    const fetcher = countingFetcher()
    const segments = segmentText('👼 <:cat:123456789012345678> 👼')

    const images = await prefetchEmoji(segments, { fetcher })

    expect(fetcher.calls).toHaveLength(2)
    expect(images.size).toBe(2)
  })

  it('keys the map by url so drawing can look each segment up', async () => {
    const segments = segmentText('<:cat:123456789012345678>')
    const url = (segments[0] as Extract<Segment, { kind: 'emoji' }>).url

    const images = await prefetchEmoji(segments, { fetcher: countingFetcher() })

    expect(images.has(url)).toBe(true)
  })

  it('omits the emoji it could not load, without failing the batch', async () => {
    const segments = segmentText('👼 <:cat:123456789012345678>')
    const fetcher: ImageFetcher = async (url) => {
      if (url.includes('discord')) throw new Error('down')
      return pixel
    }

    const images = await prefetchEmoji(segments, { fetcher })

    expect(images.size).toBe(1)
  })

  it('respects the concurrency limit', async () => {
    let active = 0
    let peak = 0
    const fetcher: ImageFetcher = async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 1))
      active--
      return pixel
    }
    const segments = segmentText(
      Array.from({ length: 10 }, (_, i) => `<:e${i}:12345678901234567${i}>`).join(''),
    )

    await prefetchEmoji(segments, { fetcher, concurrency: 3 })

    expect(peak).toBeLessThanOrEqual(3)
  })
})

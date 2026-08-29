import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AvatarFetcher } from './avatar'
import {
  drawAvatar,
  loadAvatar,
  resetFilterDetectionForTests,
  setFilterSupportedForTests,
} from './avatar'
import { avatarCacheInfo, clearAvatarCache, configureAvatarCache } from './avatarCache'
import { createCanvas } from './canvasFactory'

const DEMO_PNG = fileURLToPath(new URL('../../assets/demo.png', import.meta.url))

function redSquare(): Buffer {
  const canvas = createCanvas(4, 4)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FF0000'
  ctx.fillRect(0, 0, 4, 4)
  return canvas.toBuffer('image/png')
}

function countingFetcher(): AvatarFetcher & { calls: string[] } {
  const calls: string[] = []
  const fetcher = (async (url: string) => {
    calls.push(url)
    return redSquare()
  }) as AvatarFetcher & { calls: string[] }
  fetcher.calls = calls
  return fetcher
}

afterEach(() => {
  configureAvatarCache({})
  clearAvatarCache()
})

describe('loadAvatar', () => {
  it('returns null for no source', async () => {
    expect(await loadAvatar(null)).toBeNull()
  })

  it('fetches and decodes a remote image', async () => {
    const image = await loadAvatar('https://cdn.test/a.png', { fetcher: countingFetcher() })

    expect(image).not.toBeNull()
    expect(image?.width).toBe(4)
  })

  it('serves the second call for the same url from cache', async () => {
    const fetcher = countingFetcher()

    await loadAvatar('https://cdn.test/a.png', { fetcher })
    await loadAvatar('https://cdn.test/a.png', { fetcher })

    expect(fetcher.calls).toEqual(['https://cdn.test/a.png'])
  })

  it('coalesces concurrent requests for the same url', async () => {
    let resolve: (value: Buffer) => void = () => {}
    const calls: string[] = []
    const fetcher: AvatarFetcher = async (url) => {
      calls.push(url)
      return new Promise<Buffer>((r) => {
        resolve = r
      })
    }

    const both = Promise.all([
      loadAvatar('https://cdn.test/a.png', { fetcher }),
      loadAvatar('https://cdn.test/a.png', { fetcher }),
    ])
    resolve(redSquare())
    const [first, second] = await both

    expect(calls).toHaveLength(1)
    expect(first).toBe(second)
  })

  it('returns null instead of throwing when the fetch fails', async () => {
    const image = await loadAvatar('https://cdn.test/missing.png', {
      fetcher: async () => {
        throw new Error('404')
      },
    })

    expect(image).toBeNull()
  })

  it('remembers a failure so it is not retried immediately', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('boom')
    })

    await loadAvatar('https://cdn.test/x.png', { fetcher })
    await loadAvatar('https://cdn.test/x.png', { fetcher })

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(avatarCacheInfo().failures).toBe(1)
  })

  it('never touches the fetcher for a Buffer source', async () => {
    const fetcher = countingFetcher()

    const image = await loadAvatar(redSquare(), { fetcher })

    expect(image).not.toBeNull()
    expect(fetcher.calls).toHaveLength(0)
  })

  it('never touches the fetcher for a data: url', async () => {
    const fetcher = countingFetcher()
    const dataUrl = `data:image/png;base64,${redSquare().toString('base64')}`

    const image = await loadAvatar(dataUrl, { fetcher })

    expect(image).not.toBeNull()
    expect(fetcher.calls).toHaveLength(0)
  })

  it('reads and caches a local file path', async () => {
    const bytes = await readFile(DEMO_PNG)

    const first = await loadAvatar(DEMO_PNG)
    const second = await loadAvatar(DEMO_PNG)

    expect(first).not.toBeNull()
    expect(first?.width).toBeGreaterThan(0)
    expect(second).toBe(first)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('accepts a URL instance, keyed the same as its string form', async () => {
    const fetcher = countingFetcher()

    await loadAvatar(new URL('https://cdn.test/a.png'), { fetcher })
    await loadAvatar('https://cdn.test/a.png', { fetcher })

    expect(fetcher.calls).toEqual(['https://cdn.test/a.png'])
  })

  // Last, matching emoji/loader.test.ts's convention — afterEach only merges
  // options back, so a test that disables caching must run after every test
  // that depends on caching being on.
  it('always refetches once caching is disabled', async () => {
    configureAvatarCache({ enabled: false })
    const fetcher = countingFetcher()

    await loadAvatar('https://cdn.test/a.png', { fetcher })
    await loadAvatar('https://cdn.test/a.png', { fetcher })

    expect(fetcher.calls).toHaveLength(2)
  })
})

describe('drawAvatar grayscale fallback (no ctx.filter support)', () => {
  afterEach(() => {
    resetFilterDetectionForTests()
  })

  it('desaturates the whole painted box, including its fractional far edge', async () => {
    setFilterSupportedForTests(false)

    const canvas = createCanvas(5, 5)
    const ctx = canvas.getContext('2d')
    const image = await loadAvatar(redSquare())

    drawAvatar(ctx, image, {
      theme: {
        grayscale: true,
        position: 'left',
        widthRatio: 1,
        fit: 'cover',
        shape: 'rectangle',
        fallback: null,
      },
      // A non-integer box: painting/desaturating must cover pixel (4, 4) too,
      // not just the 4x4 region a truncated width/height would leave.
      box: { x: 0, y: 0, width: 4.9, height: 4.9 },
    })

    const { data } = ctx.getImageData(4, 4, 1, 1)
    expect(data[0]).toBe(data[1])
    expect(data[1]).toBe(data[2])
  })
})

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AvatarFetcher } from './avatar'
import { containRect, coverRect, drawAvatar, loadAvatar } from './avatar'
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

describe('coverRect', () => {
  it('crops a wide image down to match a square box', () => {
    const rect = coverRect(200, 100, { x: 0, y: 0, width: 100, height: 100 })
    expect(rect).toEqual({ sx: 50, sy: 0, sw: 100, sh: 100 })
  })

  it('crops a tall image down to match a square box', () => {
    const rect = coverRect(100, 200, { x: 0, y: 0, width: 100, height: 100 })
    expect(rect).toEqual({ sx: 0, sy: 50, sw: 100, sh: 100 })
  })

  it('uses the whole image when its aspect ratio already matches the box', () => {
    const rect = coverRect(100, 100, { x: 0, y: 0, width: 50, height: 50 })
    expect(rect).toEqual({ sx: 0, sy: 0, sw: 100, sh: 100 })
  })
})

describe('containRect', () => {
  it('letterboxes a wide image top and bottom in a square box', () => {
    const rect = containRect(200, 100, { x: 0, y: 0, width: 100, height: 100 })
    expect(rect).toEqual({ x: 0, y: 25, width: 100, height: 50 })
  })

  it('letterboxes a tall image left and right in a square box', () => {
    const rect = containRect(100, 200, { x: 0, y: 0, width: 100, height: 100 })
    expect(rect).toEqual({ x: 25, y: 0, width: 50, height: 100 })
  })

  it('fits exactly, offset with the box, when the aspect ratio already matches', () => {
    const rect = containRect(100, 100, { x: 10, y: 20, width: 50, height: 50 })
    expect(rect).toEqual({ x: 10, y: 20, width: 50, height: 50 })
  })
})

describe('drawAvatar', () => {
  it('clips to a circle when shape is circle, leaving the box corners untouched', async () => {
    const canvas = createCanvas(10, 10)
    const ctx = canvas.getContext('2d')
    const image = await loadAvatar(redSquare())

    drawAvatar(ctx, image, {
      theme: {
        grayscale: false,
        position: 'left',
        widthRatio: 1,
        fit: 'cover',
        shape: 'circle',
        fallback: null,
      },
      box: { x: 0, y: 0, width: 10, height: 10 },
    })

    const corner = ctx.getImageData(0, 0, 1, 1).data
    const center = ctx.getImageData(5, 5, 1, 1).data

    expect(corner[3]).toBe(0)
    expect(center[3]).toBe(255)
  })

  it('does not clip when shape is rectangle', async () => {
    const canvas = createCanvas(10, 10)
    const ctx = canvas.getContext('2d')
    const image = await loadAvatar(redSquare())

    drawAvatar(ctx, image, {
      theme: {
        grayscale: false,
        position: 'left',
        widthRatio: 1,
        fit: 'cover',
        shape: 'rectangle',
        fallback: null,
      },
      box: { x: 0, y: 0, width: 10, height: 10 },
    })

    const corner = ctx.getImageData(0, 0, 1, 1).data
    expect(corner[3]).toBe(255)
  })
})

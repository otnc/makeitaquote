import { describe, expect, it } from 'vitest'
import { ValidationError } from '../core/errors'
import type { OutputFormat } from '../core/types'
import { createCanvas } from '../render/canvasFactory'
import { canonicalFormat, encode, encodeDataURL, mimeType } from './encode'

function canvas() {
  const c = createCanvas(16, 16)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#3366FF'
  ctx.fillRect(0, 0, 16, 16)
  return c
}

describe('canonicalFormat', () => {
  it('passes canonical names through', () => {
    for (const format of ['png', 'jpeg', 'webp', 'avif'] as const) {
      expect(canonicalFormat(format)).toBe(format)
    }
  })

  it('accepts jpg as an alias for jpeg', () => {
    expect(canonicalFormat('jpg')).toBe('jpeg')
  })

  it('is case-insensitive', () => {
    expect(canonicalFormat('JPG' as OutputFormat)).toBe('jpeg')
    expect(canonicalFormat('PNG' as OutputFormat)).toBe('png')
  })

  it('rejects anything else, listing what it takes', () => {
    expect(() => canonicalFormat('bmp' as OutputFormat)).toThrow(ValidationError)
    expect(() => canonicalFormat('bmp' as OutputFormat)).toThrow(/jpg/)
  })
})

describe('encode', () => {
  it('produces the same bytes for jpg and jpeg', async () => {
    const [asJpg, asJpeg] = await Promise.all([encode(canvas(), 'jpg'), encode(canvas(), 'jpeg')])

    expect(asJpg).toEqual(asJpeg)
  })

  it('produces a JPEG for jpg', async () => {
    const buffer = await encode(canvas(), 'jpg')

    expect(buffer.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]))
  })

  it('honours quality through the alias', async () => {
    const low = await encode(canvas(), 'jpg', { quality: 10 })
    const high = await encode(canvas(), 'jpg', { quality: 100 })

    expect(low.length).toBeLessThan(high.length)
  })

  it('ignores quality for png', async () => {
    const a = await encode(canvas(), 'png', { quality: 10 })
    const b = await encode(canvas(), 'png', { quality: 100 })

    expect(a).toEqual(b)
  })

  it('rejects an out-of-range quality', async () => {
    await expect(encode(canvas(), 'jpg', { quality: 0 })).rejects.toThrow(ValidationError)
    await expect(encode(canvas(), 'jpg', { quality: 101 })).rejects.toThrow(ValidationError)
  })
})

describe('mime types', () => {
  it('maps jpg to image/jpeg', () => {
    expect(mimeType('jpg')).toBe('image/jpeg')
    expect(mimeType('jpeg')).toBe('image/jpeg')
  })

  it('uses the canonical type in a data url', async () => {
    const url = await encodeDataURL(canvas(), 'jpg')

    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true)
  })
})

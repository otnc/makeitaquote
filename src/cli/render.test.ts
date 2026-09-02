import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadImage } from '../render/canvasFactory'
import { renderToBuffer, resolveAvatar, resolveWatermarkImage } from './render'

describe('renderToBuffer', () => {
  it('defaults to the side layout at 1200x630', async () => {
    const buffer = await renderToBuffer({ text: 'Hi', format: 'png', offline: true })
    const { width, height } = await decodeSize(buffer)

    expect([width, height]).toEqual([1200, 630])
  })

  it('combines --theme and --layout into one theme object', async () => {
    const buffer = await renderToBuffer({
      text: 'Hi',
      theme: 'light',
      layout: 'new',
      format: 'png',
      offline: true,
    })
    const { width, height } = await decodeSize(buffer)

    expect([width, height]).toEqual([630, 790])
  })

  it('applies --layout alone, defaulting the palette to dark', async () => {
    const buffer = await renderToBuffer({
      text: 'Hi',
      layout: 'new',
      format: 'png',
      offline: true,
    })
    const { width, height } = await decodeSize(buffer)

    expect([width, height]).toEqual([630, 790])
  })
})

describe('resolveAvatar / resolveWatermarkImage', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'miq-render-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('resolveAvatar reads an existing local file as bytes', async () => {
    const file = join(dir, 'avatar.png')
    await writeFile(file, 'fake-bytes')

    expect(await resolveAvatar(file)).toEqual(Buffer.from('fake-bytes'))
  })

  it('resolveAvatar passes a non-existent path through as-is (a URL)', async () => {
    expect(await resolveAvatar('https://example.com/avatar.png')).toBe(
      'https://example.com/avatar.png',
    )
  })

  it('resolveAvatar reads stdin for -', async () => {
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      Readable.from([Buffer.from('piped')]) as never,
    )

    expect(await resolveAvatar('-')).toEqual(Buffer.from('piped'))
  })

  it('resolveWatermarkImage reads an existing local file as bytes', async () => {
    const file = join(dir, 'logo.png')
    await writeFile(file, 'fake-bytes')

    expect(await resolveWatermarkImage(file)).toEqual(Buffer.from('fake-bytes'))
  })

  it('resolveWatermarkImage wraps a non-existent path in a URL, not a bare string', async () => {
    const result = await resolveWatermarkImage('https://example.com/logo.png')

    expect(result).toBeInstanceOf(URL)
    expect((result as URL).href).toBe('https://example.com/logo.png')
  })

  it('resolveWatermarkImage wraps a data: URL the same way', async () => {
    const dataUrl = 'data:image/png;base64,AAAA'
    const result = await resolveWatermarkImage(dataUrl)

    expect(result).toBeInstanceOf(URL)
    expect((result as URL).href).toBe(dataUrl)
  })

  it('resolveWatermarkImage reads stdin for -', async () => {
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      Readable.from([Buffer.from('piped')]) as never,
    )

    expect(await resolveWatermarkImage('-')).toEqual(Buffer.from('piped'))
  })
})

/** Decodes a PNG buffer just far enough to read its dimensions back. */
async function decodeSize(buffer: Buffer): Promise<{ width: number; height: number }> {
  const image = await loadImage(buffer)
  return { width: image.width, height: image.height }
}

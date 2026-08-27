import { describe, expect, it } from 'vitest'
import { loadImage } from '../render/canvasFactory'
import { renderToBuffer } from './render'

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

/** Decodes a PNG buffer just far enough to read its dimensions back. */
async function decodeSize(buffer: Buffer): Promise<{ width: number; height: number }> {
  const image = await loadImage(buffer)
  return { width: image.width, height: image.height }
}

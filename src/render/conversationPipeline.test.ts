import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasDrawableFont } from '../__fixtures__/fonts'
import { FontNotAvailableError, ValidationError } from '../core/errors'
import { MiQConversation } from '../core/MiQConversation'
import { clearEmojiCache } from '../emoji/cache'
import { resetAutoloadForTests } from '../font/autoload'
import { createCanvas } from './canvasFactory'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function redSquare(): Buffer {
  const canvas = createCanvas(8, 8)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FF0000'
  ctx.fillRect(0, 0, 8, 8)
  return canvas.toBuffer('image/png')
}

function conversation(options?: ConstructorParameters<typeof MiQConversation>[0]) {
  return new MiQConversation({ autoFont: false, ...options })
}

async function pixelAt(
  conv: MiQConversation,
  x: number,
  y: number,
): Promise<[number, number, number, number]> {
  const canvas = await conv.render()
  const { data } = canvas.getContext('2d').getImageData(x, y, 1, 1)
  return [data[0] as number, data[1] as number, data[2] as number, data[3] as number]
}

beforeEach(() => {
  resetAutoloadForTests()
  clearEmojiCache()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})

  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url.includes('invalid')) throw new TypeError('fetch failed')
    return new Response(redSquare(), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('renderConversation', () => {
  it('produces a real PNG', async () => {
    const buffer = await conversation().addMessage({ username: 'a', text: 'hi' }).toBuffer('png')

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  })

  it('defaults to 600 wide', async () => {
    const canvas = await conversation().addMessage({ username: 'a', text: 'hi' }).render()

    expect(canvas.width).toBe(600)
  })

  it('honours a custom width', async () => {
    const canvas = await conversation({ width: 400 })
      .addMessage({ username: 'a', text: 'hi' })
      .render()

    expect(canvas.width).toBe(400)
  })

  it('rejects a non-positive width', async () => {
    await expect(
      conversation({ width: 0 }).addMessage({ username: 'a', text: 'hi' }).toBuffer(),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects an empty message list', async () => {
    await expect(conversation().toBuffer()).rejects.toThrow(ValidationError)
  })

  it('rejects a message with no text', async () => {
    await expect(
      conversation().addMessage({ username: 'a', text: '   ' }).toBuffer(),
    ).rejects.toThrow(ValidationError)
  })

  it('grows taller for more messages', async () => {
    const one = await conversation().addMessage({ username: 'a', text: 'hi' }).render()
    const two = await conversation()
      .addMessage({ username: 'a', text: 'hi' })
      .addMessage({ username: 'b', text: 'there' })
      .render()

    expect(two.height).toBeGreaterThan(one.height)
  })

  it('a grouped message (same author) adds less height than a new one', async () => {
    const grouped = await conversation()
      .addMessage({ username: 'a', text: 'one' })
      .addMessage({ username: 'a', text: 'two' })
      .render()
    const separate = await conversation()
      .addMessage({ username: 'a', text: 'one' })
      .addMessage({ username: 'b', text: 'two' })
      .render()

    expect(grouped.height).toBeLessThan(separate.height)
  })

  it('fills the background with the theme color', async () => {
    const [r, g, b, a] = await pixelAt(
      conversation().addMessage({ username: 'a', text: 'hi' }),
      590,
      2,
    )

    expect([r, g, b, a]).toEqual([0, 0, 0, 255])
  })

  it('uses white for the light theme', async () => {
    const [r, g, b] = await pixelAt(
      conversation({ theme: 'light' }).addMessage({ username: 'a', text: 'hi' }),
      590,
      2,
    )

    expect([r, g, b]).toEqual([255, 255, 255])
  })

  it('draws a circular avatar — corners stay background, centre does not', async () => {
    const miq = conversation().addMessage({
      username: 'a',
      text: 'hi',
      avatar: 'https://cdn.test/a.png',
    })

    const [cr, cg, cb] = await pixelAt(miq, 20, 20) // top-left corner of the avatar box
    expect([cr, cg, cb]).toEqual([0, 0, 0]) // background, outside the circle

    const [mr] = await pixelAt(miq, 40, 40) // centre of the avatar
    expect(mr).toBeGreaterThan(0) // the red square, desaturation aside, is not black
  })

  it('draws a fallback tile when there is no avatar', async () => {
    const [r, g, b, a] = await pixelAt(
      conversation().addMessage({ username: 'a', text: 'hi' }),
      40,
      40,
    )

    expect(a).toBe(255)
    expect([r, g, b]).not.toEqual([0, 0, 0])
  })

  it('renders text containing emoji without throwing', async () => {
    const buffer = await conversation()
      .addMessage({ username: 'a', text: 'やった👼 <:cat:123456789012345678> ね' })
      .toBuffer('png')

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  })

  it.skipIf(!hasDrawableFont())('wraps a long message onto more than one line', async () => {
    const short = await conversation().addMessage({ username: 'a', text: 'short' }).render()
    const long = await conversation()
      .addMessage({ username: 'a', text: 'a '.repeat(200) })
      .render()

    expect(long.height).toBeGreaterThan(short.height)
  })

  it('builds from setFromMessages, reading content/name/avatar per message', async () => {
    const buffer = await conversation()
      .setFromMessages([
        {
          content: 'hi',
          author: { username: 'otoneko.', displayAvatarURL: () => 'https://cdn.test/a.png' },
        },
        { content: 'there', author: { username: 'someone' } },
      ])
      .toBuffer('png')

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  })

  // autoFont is off and nothing registers the default family, so these run
  // regardless of what fonts the host actually has installed — same as the
  // main renderer's equivalent tests.
  describe('font asset errors', () => {
    it('defaults to a warning and still renders', async () => {
      const buffer = await conversation().addMessage({ username: 'a', text: 'hi' }).toBuffer('png')

      expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
      expect(console.warn).toHaveBeenCalled()
    })

    it('onAssetError: throw raises FontNotAvailableError', async () => {
      await expect(
        conversation({ onAssetError: 'throw' })
          .addMessage({ username: 'a', text: 'hi' })
          .toBuffer('png'),
      ).rejects.toThrow(FontNotAvailableError)
    })
  })
})

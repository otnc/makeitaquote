import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasDrawableFont } from '../__fixtures__/fonts'
import { FontNotAvailableError, RenderError, ValidationError } from '../core/errors'
import { MiQ } from '../core/MiQ'
import { clearEmojiCache } from '../emoji/cache'
import { resetAutoloadForTests } from '../font/autoload'
import { resetFilterDetectionForTests } from './avatar'
import { createCanvas } from './canvasFactory'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** A solid-red 8x8 PNG, used as an avatar without touching the network. */
function redSquare(): Buffer {
  const canvas = createCanvas(8, 8)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FF0000'
  ctx.fillRect(0, 0, 8, 8)
  return canvas.toBuffer('image/png')
}

/** Reads back a pixel from a rendered canvas as `[r, g, b, a]`. */
async function pixelAt(miq: MiQ, x: number, y: number): Promise<number[]> {
  const canvas = await miq.render()
  const { data } = canvas.getContext('2d').getImageData(x, y, 1, 1)
  return [data[0] as number, data[1] as number, data[2] as number, data[3] as number]
}

function quote(): MiQ {
  // autoFont off so tests never reach for a 9MB download.
  return new MiQ({ autoFont: false })
    .setText('Hello World!')
    .setUsername('otoneko.')
    .setDisplayName('音猫｡')
}

beforeEach(() => {
  resetAutoloadForTests()
  resetFilterDetectionForTests()
  clearEmojiCache()
  // A missing Japanese font is expected in CI; don't clutter the output.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})

  // Emoji and remote avatars go through fetch. Stub it so the suite never
  // depends on Twemoji or Discord being reachable — hosts containing
  // "invalid" still fail, so the fallback paths stay testable.
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

describe('render', () => {
  it('produces a real PNG', async () => {
    const buffer = await quote().toBuffer('png')

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('renders at the theme size by default', async () => {
    const canvas = await quote().render()

    expect(canvas.width).toBe(1200)
    expect(canvas.height).toBe(630)
  })

  it('honours setSize', async () => {
    const canvas = await quote().setSize(800, 400).render()

    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(400)
  })

  it('fills the background with the theme color', async () => {
    // Top-right: past the avatar box and the gradient, and above the text.
    const [r, g, b, a] = await pixelAt(quote(), 1100, 5)

    expect([r, g, b]).toEqual([0, 0, 0])
    expect(a).toBe(255)
  })

  it('draws a background image over the background color', async () => {
    const miq = quote().setTheme({
      backgroundImage: { source: 'https://cdn.test/bg.png', fit: 'cover', opacity: 1 },
    })

    // Top-right, same spot the plain color test reads — now the image, not #000.
    const [r, g, b] = await pixelAt(miq, 1100, 5)

    expect([r, g, b]).toEqual([255, 0, 0])
  })

  it('blends a translucent background image with the background color', async () => {
    const miq = quote().setTheme({
      backgroundImage: { source: 'https://cdn.test/bg.png', fit: 'cover', opacity: 0.5 },
    })

    const [r, g, b] = await pixelAt(miq, 1100, 5)

    // Halfway between black background and pure red image.
    expect(r).toBeGreaterThan(100)
    expect(r).toBeLessThan(155)
    expect(g).toBe(0)
    expect(b).toBe(0)
  })

  it('letterboxes a contained background image with the background color', async () => {
    const miq = quote().setTheme({
      backgroundImage: { source: 'https://cdn.test/bg.png', fit: 'contain', opacity: 1 },
    })

    // The square source, scaled into 1200x630, lands at x∈[285,915]. The
    // gradient covers up to x=600 though, so only a point past both that and
    // the image's own edge reads the plain background, and only a point past
    // the gradient but still inside the image reads the image untouched.
    const [barR, barG, barB] = await pixelAt(miq, 1100, 5) // right of the image
    expect([barR, barG, barB]).toEqual([0, 0, 0])

    const [imgR, imgG, imgB] = await pixelAt(miq, 750, 5) // inside it, past the gradient
    expect([imgR, imgG, imgB]).toEqual([255, 0, 0])
  })

  it('leaves the background plain when the image fails to load', async () => {
    const miq = quote().setTheme({
      backgroundImage: { source: 'https://invalid.test/nope.png', fit: 'cover', opacity: 1 },
    })

    const [r, g, b] = await pixelAt(miq, 1100, 5)

    expect([r, g, b]).toEqual([0, 0, 0])
  })

  it('uses white for the light theme background', async () => {
    const [r, g, b] = await pixelAt(quote().setTheme('light'), 1100, 5)

    expect([r, g, b]).toEqual([255, 255, 255])
  })

  it.skipIf(!hasDrawableFont())('draws something in the text area', async () => {
    const canvas = await quote().render()
    const ctx = canvas.getContext('2d')
    const { data } = ctx.getImageData(700, 250, 400, 250)

    let lit = 0
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i] as number) > 32) lit++
    }

    expect(lit).toBeGreaterThan(0)
  })

  it('desaturates the avatar', async () => {
    const [r, g, b] = await pixelAt(quote().setAvatar(redSquare()), 100, 315)

    // Pure red at Rec.709 luma is a mid-dark grey; what matters is that the
    // channels now agree.
    expect(r).toBe(g)
    expect(g).toBe(b)
    expect(r).toBeGreaterThan(0)
  })

  it('keeps the avatar in color for the color theme', async () => {
    const [r, g, b] = await pixelAt(quote().setAvatar(redSquare()).setTheme('color'), 100, 315)

    expect(r).toBeGreaterThan(200)
    expect(g).toBeLessThan(60)
    expect(b).toBeLessThan(60)
  })

  it('draws a fallback tile when the avatar cannot be loaded', async () => {
    const [r, g, b, a] = await pixelAt(quote().setAvatar('https://invalid.test/nope.png'), 100, 315)

    // The dark theme's fallback is #1E1E1E, not the #000 background.
    expect(a).toBe(255)
    expect([r, g, b]).toEqual([30, 30, 30])
  })

  it('draws a fallback tile when there is no avatar at all', async () => {
    const [r, g, b] = await pixelAt(quote(), 100, 315)

    expect([r, g, b]).toEqual([30, 30, 30])
  })

  it('clips the avatar box to a circle', async () => {
    // Dark theme, side layout: box is {x:0, y:0, width:600, height:630}, so
    // its corner sits well outside the largest inscribed circle (r=300).
    const miq = quote()
      .setAvatar(redSquare())
      .setTheme({ avatar: { shape: 'circle' } })

    const [, , , cornerAlpha] = await pixelAt(miq, 10, 10)
    expect(cornerAlpha).toBe(255)
    const [cr, cg, cb] = await pixelAt(miq, 10, 10)
    expect([cr, cg, cb]).toEqual([0, 0, 0]) // untouched background, not the avatar

    const [, cgCentre, cbCentre] = await pixelAt(miq, 300, 315)
    expect(cgCentre).toBe(cbCentre) // inside the circle: desaturated red
    expect(cgCentre).toBeGreaterThan(0)
  })

  it('clips the fallback tile to a circle too', async () => {
    const miq = quote().setTheme({ avatar: { shape: 'circle' } })

    const [r, g, b] = await pixelAt(miq, 10, 10)
    expect([r, g, b]).toEqual([0, 0, 0]) // background, not the fallback tile's #1E1E1E

    // Inside the circle but away from the centred initial letter's glyph.
    const [fr, fg, fb] = await pixelAt(miq, 50, 315)
    expect([fr, fg, fb]).toEqual([30, 30, 30])
  })

  it('puts the avatar on the right when the theme says so', async () => {
    const miq = quote()
      .setAvatar(redSquare())
      .setTheme({ avatar: { position: 'right' } })

    const [, , , leftAlpha] = await pixelAt(miq, 1100, 315)
    expect(leftAlpha).toBe(255)

    const canvas = await miq.render()
    const { data } = canvas.getContext('2d').getImageData(1100, 315, 1, 1)
    // Greyscaled red, so all three channels match and none are black.
    expect(data[0]).toBe(data[1])
    expect(data[0]).toBeGreaterThan(0)
  })

  it('renders Japanese text without throwing', async () => {
    const buffer = await new MiQ({ autoFont: false })
      .setText('吾輩は猫である。名前はまだ無い。どこで生れたか頓と見当がつかぬ。')
      .setUsername('otoneko.')
      .toBuffer('png')

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  })

  it('renders text containing emoji without throwing', async () => {
    const buffer = await new MiQ({ autoFont: false })
      .setText('やった👼 <:cat:123456789012345678> ね')
      .setUsername('otoneko.')
      .toBuffer('png')

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  })

  it('renders a very long quote by shrinking it', async () => {
    const buffer = await new MiQ({ autoFont: false })
      .setText('あ'.repeat(400))
      .setUsername('otoneko.')
      .toBuffer('png')

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  })

  it.skipIf(!hasDrawableFont())(
    'throws when the text cannot fit and overflow is error',
    async () => {
      const miq = new MiQ({ autoFont: false })
        .setText('あ'.repeat(2000))
        .setTheme({ text: { overflow: 'error' } })

      await expect(miq.toBuffer()).rejects.toThrow(RenderError)
    },
  )

  it('requires text', async () => {
    await expect(new MiQ({ autoFont: false }).toBuffer()).rejects.toThrow(ValidationError)
  })

  it('renders a watermark without throwing', async () => {
    const buffer = await quote().setWatermark('Make it a Quote').toBuffer('png')

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  })
})

describe('portrait / stacked layout', () => {
  it('renders the portrait preset', async () => {
    const buffer = await quote().setTheme('portrait').setAvatar(redSquare()).toBuffer('png')

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  })

  it('uses the preset portrait size', async () => {
    const canvas = await quote().setTheme('portrait').render()

    expect(canvas.height).toBeGreaterThan(canvas.width)
  })

  it('fills the whole canvas with the avatar', async () => {
    // Top-right would be background in a side layout; here it is the avatar.
    const miq = quote().setTheme('portrait').setAvatar(redSquare()).setSize(400, 600)
    const [r, g, b] = await pixelAt(miq, 395, 5)

    expect(r).toBe(g)
    expect(g).toBe(b)
    expect(r).toBeGreaterThan(0)
  })

  it('fades downwards rather than sideways', async () => {
    const miq = quote().setTheme('portrait').setAvatar(redSquare()).setSize(400, 600)
    const canvas = await miq.render()
    const ctx = canvas.getContext('2d')

    const top = ctx.getImageData(200, 5, 1, 1).data[0] as number
    const bottom = ctx.getImageData(200, 595, 1, 1).data[0] as number

    // The bottom has faded to the black background; the top has not.
    expect(top).toBeGreaterThan(bottom)
    expect(bottom).toBeLessThan(16)
  })

  it('renders portrait-light on white', async () => {
    const miq = quote().setTheme('portrait-light').setAvatar(redSquare()).setSize(400, 600)
    const [r, g, b] = await pixelAt(miq, 200, 595)

    expect([r, g, b]).toEqual([255, 255, 255])
  })

  it('works on a landscape canvas too', async () => {
    const canvas = await quote()
      .setTheme({ extends: 'portrait', width: 800, height: 400 })
      .setAvatar(redSquare())
      .render()

    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(400)
  })
})

describe('flipped layout', () => {
  it('moves the text with the avatar', async () => {
    // No avatar and no fallback tile, so the only ink is the text itself.
    const ink = async (position: 'left' | 'right') => {
      const canvas = await new MiQ({ autoFont: false })
        .setText('あ'.repeat(30))
        .setUsername('otoneko.')
        .setTheme({ avatar: { position, fallback: null } })
        .render()
      const ctx = canvas.getContext('2d')
      return {
        left: countLit(ctx.getImageData(0, 0, 600, 630).data),
        right: countLit(ctx.getImageData(600, 0, 600, 630).data),
      }
    }

    const avatarLeft = await ink('left')
    const avatarRight = await ink('right')

    expect(avatarLeft.right).toBeGreaterThan(avatarLeft.left)
    expect(avatarRight.left).toBeGreaterThan(avatarRight.right)
  })

  it('puts the avatar on the right', async () => {
    const miq = quote()
      .setTheme({ avatar: { position: 'right' } })
      .setAvatar(redSquare())
    const [r, g] = await pixelAt(miq, 1100, 315)

    expect(r).toBe(g)
    expect(r).toBeGreaterThan(0)
  })
})

describe.skipIf(!hasDrawableFont())('font weight', () => {
  it('draws bold text with more ink than regular', async () => {
    const ink = async (weight: 'normal' | 'bold') => {
      const canvas = await new MiQ({ autoFont: false })
        .setText('Bold Test')
        .setTheme({ text: { weight } })
        .render()
      return countLit(canvas.getContext('2d').getImageData(700, 250, 500, 250).data)
    }

    expect(await ink('bold')).toBeGreaterThan(await ink('normal'))
  })

  it('accepts a numeric weight', async () => {
    const buffer = await quote()
      .setTheme({ text: { weight: 700 } })
      .toBuffer('png')

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  })
})

describe.skipIf(!hasDrawableFont())('divider and block quote marks', () => {
  it('draws a rule when the divider is enabled', async () => {
    // A color nothing else in the image uses, so it can be counted directly
    // without depending on where the divider lands.
    expect(await countRed({ divider: { enabled: true, color: '#FF0000' } })).toBeGreaterThan(0)
  })

  it('draws no rule when the divider is disabled', async () => {
    expect(await countRed({ divider: { enabled: false, color: '#FF0000' } })).toBe(0)
  })

  it('draws block quote marks above the quote', async () => {
    const block = await new MiQ({ autoFont: false })
      .setText('test')
      .setTheme({ quoteMark: { display: 'block' } })
      .render()
    const none = await new MiQ({ autoFont: false })
      .setText('test')
      .setTheme({ quoteMark: { display: 'none' } })
      .render()

    const blockInk = countLit(block.getContext('2d').getImageData(700, 100, 500, 560).data)
    const noneInk = countLit(none.getContext('2d').getImageData(700, 100, 500, 560).data)

    expect(blockInk).toBeGreaterThan(noneInk)
  })

  it('omits the marks entirely when display is none', async () => {
    const canvas = await new MiQ({ autoFont: false })
      .setText('test')
      .setTheme({ quoteMark: { display: 'none' } })
      .render()

    expect(countLit(canvas.getContext('2d').getImageData(700, 100, 500, 560).data)).toBeGreaterThan(
      0,
    )
  })
})

/** Counts strongly-red pixels, used to find something drawn in pure red. */
async function countRed(theme: object): Promise<number> {
  const canvas = await new MiQ({ autoFont: false })
    .setText('test')
    .setUsername('otoneko.')
    .setTheme(theme)
    .render()

  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
  let red = 0
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i] as number) > 200 && (data[i + 1] as number) < 60 && (data[i + 2] as number) < 60) {
      red++
    }
  }
  return red
}

function countLit(data: Uint8ClampedArray): number {
  let lit = 0
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i] as number) > 32) lit++
  }
  return lit
}

describe('output formats', () => {
  it('encodes jpeg', async () => {
    const buffer = await quote().toBuffer('jpeg')

    expect(buffer.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]))
  })

  it('encodes webp', async () => {
    const buffer = await quote().toBuffer('webp')

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(buffer.subarray(8, 12).toString('ascii')).toBe('WEBP')
  })

  it('rejects an unknown format', async () => {
    await expect(quote().toBuffer('bmp' as 'png')).rejects.toThrow(ValidationError)
  })

  it('rejects a quality outside 1-100', async () => {
    await expect(quote().toBuffer('jpeg', { quality: 0 })).rejects.toThrow(ValidationError)
    await expect(quote().toBuffer('jpeg', { quality: 101 })).rejects.toThrow(ValidationError)
  })

  it('produces a data url', async () => {
    const url = await quote().toDataURL('png')

    expect(url.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('produces a stream', async () => {
    const stream = await quote().toStream('png')
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)

    expect(Buffer.concat(chunks).subarray(0, 8)).toEqual(PNG_SIGNATURE)
  })
})

describe('font asset errors', () => {
  // Not on the machine, not in Google Fonts, not registered by hand — always
  // "missing", regardless of what fonts the host actually has installed.
  const MISSING_FONT = 'Definitely Not A Real Font 12345'

  function withMissingFont(options: ConstructorParameters<typeof MiQ>[0] = {}) {
    return new MiQ({ autoFont: false, ...options })
      .setText('Hello World!')
      .setUsername('otoneko.')
      .setTheme({ text: { font: MISSING_FONT } })
  }

  it('defaults to a warning and still renders', async () => {
    const buffer = await withMissingFont().toBuffer('png')

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
    expect(console.warn).toHaveBeenCalledOnce()
  })

  it('onAssetError: ignore renders without warning', async () => {
    const buffer = await withMissingFont({ onAssetError: 'ignore' }).toBuffer('png')

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('onAssetError: throw raises FontNotAvailableError', async () => {
    await expect(withMissingFont({ onAssetError: 'throw' }).toBuffer('png')).rejects.toThrow(
      FontNotAvailableError,
    )
  })

  it('strictFonts overrides onAssetError: ignore', async () => {
    await expect(
      withMissingFont({ onAssetError: 'ignore', strictFonts: true }).toBuffer('png'),
    ).rejects.toThrow(FontNotAvailableError)
  })
})

describe('MiQ', () => {
  it('returns itself from every setter, so calls chain', () => {
    const miq = new MiQ()

    expect(miq.setText('a')).toBe(miq)
    expect(miq.setUsername('b')).toBe(miq)
    expect(miq.setDisplayName('c')).toBe(miq)
    expect(miq.setWatermark('d')).toBe(miq)
    expect(miq.setAvatar(null)).toBe(miq)
    expect(miq.setTheme('light')).toBe(miq)
    expect(miq.setSize(100, 100)).toBe(miq)
  })

  it('clone does not share data with the original', () => {
    const original = new MiQ().setText('first')
    const copy = original.clone().setText('second')

    expect(original.getData().text).toBe('first')
    expect(copy.getData().text).toBe('second')
  })

  it('clone does not share the theme with the original', () => {
    const original = new MiQ().setSize(800, 400)
    const copy = original.clone().setSize(1600, 900)

    expect(original.getTheme().width).toBe(800)
    expect(copy.getTheme().width).toBe(1600)
  })

  it('getTheme hands back a copy', () => {
    const miq = new MiQ()
    const theme = miq.getTheme() as { background: string }
    theme.background = '#FF0000'

    expect(miq.getTheme().background).toBe('#000000')
  })

  it('keeps an explicit size across a theme change', () => {
    const miq = new MiQ().setSize(800, 400).setTheme({ extends: 'light' })

    expect(miq.getTheme().width).toBe(800)
    expect(miq.getTheme().height).toBe(400)
  })

  it('lets a theme set the size explicitly', () => {
    const miq = new MiQ().setSize(800, 400).setTheme({ width: 1000, height: 500 })

    expect(miq.getTheme().width).toBe(1000)
  })

  it('rejects a non-positive size', () => {
    expect(() => new MiQ().setSize(0, 100)).toThrow(ValidationError)
    expect(() => new MiQ().setSize(100, -1)).toThrow(ValidationError)
  })

  it('reads color: true from setFromObject as the color theme', () => {
    const miq = new MiQ().setFromObject({ text: 'hi', color: true })

    expect(miq.getTheme().avatar.grayscale).toBe(false)
  })

  it('rejects text that is not a string', () => {
    expect(() => new MiQ().setText(42 as unknown as string)).toThrow(ValidationError)
  })

  it('rejects text over the length limit', () => {
    expect(() => new MiQ().setText('a'.repeat(4001))).toThrow(ValidationError)
  })
})

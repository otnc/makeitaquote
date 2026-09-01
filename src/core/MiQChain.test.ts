import { describe, expect, it } from 'vitest'
import { ValidationError } from './errors'
import { MiQ } from './MiQ'
import { MiQChain, resolvePosition } from './MiQChain'

function quote(): MiQ {
  return new MiQ({ autoFont: false }).setText('hello').setUsername('otoneko.')
}

describe('resolvePosition', () => {
  it('defaults to top=right, bottom=left', () => {
    expect(resolvePosition({}, true)).toBe('right')
    expect(resolvePosition({}, false)).toBe('left')
  })

  it('flip inverts the pairing', () => {
    expect(resolvePosition({ flip: true }, true)).toBe('left')
    expect(resolvePosition({ flip: true }, false)).toBe('right')
  })

  it('a per-side override wins over flip, for that side only', () => {
    expect(resolvePosition({ flip: true, topFlip: false }, true)).toBe('left')
    expect(resolvePosition({ flip: true, topFlip: false }, false)).toBe('right')

    expect(resolvePosition({ topFlip: true }, true)).toBe('right')
    expect(resolvePosition({ bottomFlip: true }, false)).toBe('right')
    expect(resolvePosition({ bottomFlip: false }, false)).toBe('left')
  })
})

describe('MiQChain', () => {
  it('never mutates the MiQ instances passed in', async () => {
    const top = quote()
    const bottom = quote()
    const beforeTop = top.getTheme().avatar.position
    const beforeBottom = bottom.getTheme().avatar.position

    await new MiQChain(top, bottom, { flip: true }).render()

    expect(top.getTheme().avatar.position).toBe(beforeTop)
    expect(bottom.getTheme().avatar.position).toBe(beforeBottom)
  })

  it('rejects a top quote using layout: "new"', async () => {
    const top = quote().setTheme({ layout: 'new' })
    const chain = new MiQChain(top, quote())

    await expect(chain.render()).rejects.toThrow(ValidationError)
    await expect(chain.render()).rejects.toThrow(/top/)
  })

  it('rejects a bottom quote using layout: "new"', async () => {
    const bottom = quote().setTheme({ layout: 'new' })
    const chain = new MiQChain(quote(), bottom)

    await expect(chain.render()).rejects.toThrow(ValidationError)
    await expect(chain.render()).rejects.toThrow(/bottom/)
  })

  it('rejects mismatched widths rather than silently stretching', async () => {
    const top = quote().setTheme({ width: 1200 })
    const bottom = quote().setTheme({ width: 800 })
    const chain = new MiQChain(top, bottom)

    await expect(chain.render()).rejects.toThrow(ValidationError)
    await expect(chain.render()).rejects.toThrow(/same width/)
  })

  it('stacks top and bottom into one canvas of their combined height', async () => {
    const top = quote()
    const bottom = quote()
    const [topCanvas, bottomCanvas] = await Promise.all([
      top.clone().render(),
      bottom.clone().render(),
    ])

    const canvas = await new MiQChain(top, bottom).render()

    expect(canvas.width).toBe(topCanvas.width)
    expect(canvas.height).toBe(topCanvas.height + bottomCanvas.height)
  })

  it('produces a real PNG through toBuffer', async () => {
    const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const buffer = await new MiQChain(quote(), quote()).toBuffer('png')

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  })
})

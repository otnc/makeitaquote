import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvas } from '../render/canvasFactory'
import { fontString } from '../render/layout'
import { resetBoldDetectionForTests, resolvedWeight, syntheticBoldWidth } from '../render/textStyle'
import { type DrawLineOptions, drawLine, drawnLineWidth, measureLine } from './draw'
import type { Line } from './wrap'

function context() {
  return createCanvas(200, 100).getContext('2d')
}

function options(overrides: Partial<DrawLineOptions> = {}): DrawLineOptions {
  return {
    fontSize: 40,
    sideMarginRatio: 0,
    topMarginRatio: 0,
    images: new Map(),
    onMissing: 'ignore',
    baseWeight: 'normal',
    family: 'sans-serif',
    ...overrides,
  }
}

beforeEach(() => {
  resetBoldDetectionForTests()
})

describe('drawnLineWidth / drawLine agreement', () => {
  it('drawLine reuses precomputed widths instead of re-measuring, when the caller passes them', () => {
    const ctx = context()
    const line: Line = [{ kind: 'text', value: 'hello' }]
    const widths = measureLine(ctx, line, options())
    const spy = vi.spyOn(ctx, 'measureText')

    drawLine(ctx, line, 0, 50, options(), widths)

    // pipeline.ts computes `widths` once (for alignedX) and passes it here — drawLine must not measure the same segment a second time on top of that.
    expect(spy).not.toHaveBeenCalled()
  })

  it('drawLine measures its own widths when the caller has none to share', () => {
    const ctx = context()
    const line: Line = [{ kind: 'text', value: 'hello' }]
    const spy = vi.spyOn(ctx, 'measureText')

    drawLine(ctx, line, 0, 50, options())

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('agrees with the actual cursor advance drawLine uses, including a raw emoji-fallback segment', () => {
    const ctx = context()
    const line: Line = [
      { kind: 'text', value: 'hi ' },
      {
        kind: 'emoji',
        source: 'discord',
        url: 'https://cdn.discordapp.com/emojis/123.png',
        id: '123',
        name: 'blob',
        animated: false,
        raw: '<:blob:123>',
      },
    ]
    const opts = options({ onMissing: 'text' })

    const width = drawnLineWidth(ctx, line, opts)

    let cursor = 0
    cursor += ctx.measureText('hi ').width
    cursor += ctx.measureText('<:blob:123>').width

    expect(width).toBeCloseTo(cursor)
  })

  it('includes the synthetic-bold stroke width in a bold segment measurement', () => {
    const ctx = context()
    const opts = options()
    const weight = resolvedWeight(opts.baseWeight, true)

    // The same primitives applyFont() uses internally, so this is an independent check of measureLine()'s formula rather than a tautology.
    ctx.font = fontString(weight, opts.fontSize, opts.family, false)
    const stroke = syntheticBoldWidth(ctx, weight, opts.family, opts.fontSize)
    const textWidth = ctx.measureText('bold text').width

    const [width] = measureLine(
      ctx,
      [{ kind: 'text', value: 'bold text', style: { bold: true } }],
      opts,
    )

    expect(width).toBeCloseTo(textWidth + stroke)
  })

  it('draws nothing and advances nothing for a missing emoji when onMissing is ignore', () => {
    const ctx = context()
    const line: Line = [
      { kind: 'text', value: 'a' },
      {
        kind: 'emoji',
        source: 'discord',
        url: 'https://cdn.discordapp.com/emojis/123.png',
        id: '123',
        name: 'blob',
        animated: false,
        raw: '<:blob:123>',
      },
      { kind: 'text', value: 'b' },
    ]
    const opts = options({ onMissing: 'ignore' })

    const width = drawnLineWidth(ctx, line, opts)
    const expected = ctx.measureText('a').width + ctx.measureText('b').width

    expect(width).toBeCloseTo(expected)
  })
})

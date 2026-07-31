import { beforeEach, describe, expect, it } from 'vitest'
import { type Canvas, createCanvas } from './canvasFactory'
import { fillText, isBold, resetBoldDetectionForTests, syntheticBoldWidth } from './textStyle'

function context() {
  return createCanvas(100, 100).getContext('2d')
}

beforeEach(() => {
  resetBoldDetectionForTests()
})

describe('isBold', () => {
  it('recognises the keywords', () => {
    expect(isBold('bold')).toBe(true)
    expect(isBold('bolder')).toBe(true)
    expect(isBold('normal')).toBe(false)
    expect(isBold('lighter')).toBe(false)
  })

  it('treats 600 and above as bold', () => {
    expect(isBold(500)).toBe(false)
    expect(isBold(600)).toBe(true)
    expect(isBold(900)).toBe(true)
  })
})

describe('syntheticBoldWidth', () => {
  it('is zero for a regular weight', () => {
    expect(syntheticBoldWidth(context(), 'normal', 'sans-serif', 40)).toBe(0)
    expect(syntheticBoldWidth(context(), 400, 'sans-serif', 40)).toBe(0)
  })

  it('scales with the font size when a stroke is needed', () => {
    const ctx = context()
    const small = syntheticBoldWidth(ctx, 'bold', 'sans-serif', 20)
    const large = syntheticBoldWidth(ctx, 'bold', 'sans-serif', 80)

    // Either the family has a real bold (both zero) or it is faked, in which
    // case the stroke has to grow with the text.
    if (small > 0) expect(large).toBeCloseTo(small * 4)
    else expect(large).toBe(0)
  })

  it('gives a heavier stroke to a heavier numeric weight', () => {
    const ctx = context()
    const six = syntheticBoldWidth(ctx, 600, 'sans-serif', 40)
    const nine = syntheticBoldWidth(ctx, 900, 'sans-serif', 40)

    if (nine > 0) expect(nine).toBeGreaterThan(six)
  })
})

describe('fillText', () => {
  it('draws without a stroke when the width is zero', () => {
    const canvas = createCanvas(60, 60)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '40px sans-serif'
    ctx.textBaseline = 'top'
    fillText(ctx, 'I', 10, 5, 0)

    expect(litPixels(canvas)).toBeGreaterThan(0)
  })

  it('covers more pixels when stroked', () => {
    const plain = renderGlyph(0)
    const stroked = renderGlyph(4)

    expect(stroked).toBeGreaterThan(plain)
  })

  it('leaves the context state alone', () => {
    const ctx = context()
    ctx.lineWidth = 7
    ctx.strokeStyle = '#123456'
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '40px sans-serif'

    fillText(ctx, 'I', 10, 40, 3)

    expect(ctx.lineWidth).toBe(7)
    expect(ctx.strokeStyle).toBe('#123456')
  })
})

function renderGlyph(stroke: number): number {
  const canvas = createCanvas(60, 60)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '40px sans-serif'
  ctx.textBaseline = 'top'
  fillText(ctx, 'I', 10, 5, stroke)
  return litPixels(canvas)
}

function litPixels(canvas: Canvas): number {
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
  let lit = 0
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i] as number) > 32) lit++
  }
  return lit
}

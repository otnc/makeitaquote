import { describe, expect, it } from 'vitest'
import { fakeMeasurer, fakeMetrics } from '../__fixtures__/measurer'
import { RenderError } from '../core/errors'
import type { TextOverflow } from '../theme/types'
import { fitText, linesToStrings } from './fit'
import { segmentText } from './segment'

/**
 * Character width scales with the font size, the way a real font does: at
 * 20px an ASCII character is 10 wide, at 10px it is 5.
 */
function options(overrides: Partial<Parameters<typeof fitText>[1]> = {}) {
  return {
    maxWidth: 100,
    maxHeight: 100,
    maxFontSize: 20,
    minFontSize: 10,
    lineHeight: 1,
    overflow: 'ellipsis' as TextOverflow,
    measurerFor: (fontSize: number) => fakeMeasurer(fontSize / 2),
    metricsFor: (fontSize: number) => fakeMetrics(fontSize, 0),
    ...overrides,
  }
}

describe('fitText', () => {
  it('keeps the maximum size when the text already fits', () => {
    const result = fitText(segmentText('ab'), options())

    expect(result.fontSize).toBe(20)
    expect(result.truncated).toBe(false)
    expect(linesToStrings(result.lines)).toEqual(['ab'])
  })

  it('shrinks until the text fits the box', () => {
    // 10 lines at 20px would be 200 tall and the box is 100, but at 10px they
    // fit exactly — so this shrinks rather than truncating.
    const result = fitText(segmentText('a\nb\nc\nd\ne\nf\ng\nh\ni\nj'), options())

    expect(result.fontSize).toBe(10)
    expect(result.lines).toHaveLength(10)
    expect(result.truncated).toBe(false)
  })

  it('reports the size it settled on', () => {
    const result = fitText(segmentText('a\nb\nc\nd\ne'), options({ maxHeight: 50 }))

    expect(result.fontSize).toBe(10)
    expect(result.lines).toHaveLength(5)
  })

  it('truncates with an ellipsis when even the minimum size overflows', () => {
    const result = fitText(
      segmentText(Array.from({ length: 40 }, (_, i) => `line${i}`).join('\n')),
      options(),
    )

    expect(result.truncated).toBe(true)
    expect(result.lines.length * result.fontSize).toBeLessThanOrEqual(100)
    expect(linesToStrings(result.lines).at(-1)).toContain('…')
  })

  it('keeps every line when overflow is shrink, even though it spills', () => {
    const source = Array.from({ length: 40 }, (_, i) => `line${i}`).join('\n')
    const result = fitText(segmentText(source), options({ overflow: 'shrink' }))

    expect(result.truncated).toBe(false)
    expect(result.lines).toHaveLength(40)
    expect(result.fontSize).toBe(10)
  })

  it('throws when overflow is error', () => {
    const source = Array.from({ length: 40 }, (_, i) => `line${i}`).join('\n')

    expect(() => fitText(segmentText(source), options({ overflow: 'error' }))).toThrow(RenderError)
  })

  it('says how many lines were needed when it throws', () => {
    const source = Array.from({ length: 40 }, (_, i) => `line${i}`).join('\n')

    expect(() => fitText(segmentText(source), options({ overflow: 'error' }))).toThrow(/40 lines/)
  })

  it('never returns a size below the minimum', () => {
    const source = Array.from({ length: 200 }, () => 'x').join('\n')
    const result = fitText(segmentText(source), options({ minFontSize: 8 }))

    expect(result.fontSize).toBeGreaterThanOrEqual(8)
  })

  it('handles empty text', () => {
    const result = fitText(segmentText(''), options())

    expect(result.lines).toEqual([[]])
    expect(result.fontSize).toBe(20)
  })

  it('wraps Japanese and shrinks it to fit', () => {
    const result = fitText(
      segmentText('今日はとてもいい天気ですね。散歩に行きましょう。'),
      options({ maxHeight: 60 }),
    )

    expect(result.lines.length * result.fontSize).toBeLessThanOrEqual(60)
    for (const line of linesToStrings(result.lines)) {
      expect(line.startsWith('。')).toBe(false)
    }
  })
})

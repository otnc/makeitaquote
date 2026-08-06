import { describe, expect, it } from 'vitest'
import { defineTheme } from '../theme/resolve'
import { autoArea, computeLayout, fontString, gradientLine } from './layout'

describe('computeLayout · side', () => {
  it('puts the avatar on the left by default', () => {
    const { avatar } = computeLayout(defineTheme('dark'))

    expect(avatar).toEqual({ x: 0, y: 0, width: 600, height: 630 })
  })

  it('puts the avatar on the right when asked', () => {
    const { avatar } = computeLayout(defineTheme({ avatar: { position: 'right' } }))

    expect(avatar).toEqual({ x: 600, y: 0, width: 600, height: 630 })
  })

  it('honours a narrower avatar', () => {
    const { avatar } = computeLayout(defineTheme({ avatar: { widthRatio: 0.35 } }))

    expect(avatar.width).toBe(1200 * 0.35)
  })

  it('places the text opposite a left avatar', () => {
    const { text } = computeLayout(defineTheme('dark'))

    expect(text.x).toBeCloseTo(1200 * 0.54)
    expect(text.x + text.width).toBeCloseTo(1200 * 0.96)
  })

  it('moves the text with the avatar when it flips', () => {
    const { text } = computeLayout(defineTheme({ avatar: { position: 'right' } }))

    expect(text.x).toBeCloseTo(1200 * 0.04)
    expect(text.x + text.width).toBeCloseTo(1200 * 0.46)
  })

  it('never lets the text overlap the avatar', () => {
    for (const position of ['left', 'right'] as const) {
      for (const widthRatio of [0.3, 0.5, 0.65]) {
        const layout = computeLayout(defineTheme({ avatar: { position, widthRatio } }))
        const overlaps =
          layout.text.x < layout.avatar.x + layout.avatar.width &&
          layout.text.x + layout.text.width > layout.avatar.x

        expect(overlaps, `${position} @ ${widthRatio}`).toBe(false)
      }
    }
  })

  it('uses an explicit area verbatim', () => {
    const theme = defineTheme({ text: { area: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } } })
    const { text } = computeLayout(theme)

    expect(text.x).toBeCloseTo(theme.width * 0.1)
    expect(text.y).toBeCloseTo(theme.height * 0.2)
    expect(text.width).toBeCloseTo(theme.width * 0.3)
    expect(text.height).toBeCloseTo(theme.height * 0.4)
  })

  it('centres the attribution on the text area', () => {
    const { text, centreX } = computeLayout(defineTheme('dark'))

    expect(centreX).toBe(text.x + text.width / 2)
  })
})

describe('computeLayout · stacked', () => {
  it('fills the canvas with the avatar', () => {
    const theme = defineTheme('portrait')
    const { avatar } = computeLayout(theme)

    expect(avatar).toEqual({ x: 0, y: 0, width: theme.width, height: theme.height })
  })

  it('ignores the avatar side', () => {
    const left = computeLayout(defineTheme({ extends: 'portrait', avatar: { position: 'left' } }))
    const right = computeLayout(defineTheme({ extends: 'portrait', avatar: { position: 'right' } }))

    expect(left.avatar).toEqual(right.avatar)
  })

  it('puts the quote across the lower half', () => {
    const theme = defineTheme('portrait')
    const { text } = computeLayout(theme)

    expect(text.y).toBeGreaterThan(theme.height * 0.5)
    expect(text.x + text.width).toBeLessThanOrEqual(theme.width)
  })

  it('centres the quote horizontally', () => {
    const theme = defineTheme('portrait')
    const { centreX } = computeLayout(theme)

    expect(centreX).toBeCloseTo(theme.width / 2)
  })
})

describe('autoArea', () => {
  it('mirrors when the avatar flips', () => {
    const left = autoArea(defineTheme({ avatar: { position: 'left' } }))
    const right = autoArea(defineTheme({ avatar: { position: 'right' } }))

    expect(left.width).toBeCloseTo(right.width)
    expect(left.x + left.width).toBeCloseTo(1 - right.x)
  })
})

describe('gradientLine', () => {
  it('runs left to right for a left avatar', () => {
    const [x0, y0, x1, y1] = gradientLine(defineTheme('dark'))

    expect(x0).toBeLessThan(x1)
    expect(y0).toBe(0)
    expect(y1).toBe(0)
  })

  it('mirrors for a right avatar', () => {
    const [x0, , x1] = gradientLine(defineTheme({ avatar: { position: 'right' } }))

    expect(x0).toBeGreaterThan(x1)
  })

  it('runs top to bottom when vertical', () => {
    const [x0, y0, x1, y1] = gradientLine(defineTheme('portrait'))

    expect(x0).toBe(0)
    expect(x1).toBe(0)
    expect(y0).toBeLessThan(y1)
  })

  it('does not mirror a vertical gradient for a right avatar', () => {
    const theme = defineTheme({ extends: 'portrait', avatar: { position: 'right' } })
    const [, y0, , y1] = gradientLine(theme)

    expect(y0).toBeLessThan(y1)
  })
})

describe('fontString', () => {
  it('omits a normal weight', () => {
    expect(fontString('normal', 32, 'Noto Sans JP')).toBe('32px Noto Sans JP')
  })

  it('includes a keyword weight', () => {
    expect(fontString('bold', 32, 'Noto Sans JP')).toBe('bold 32px Noto Sans JP')
  })

  it('includes a numeric weight', () => {
    expect(fontString(700, 32, 'Noto Sans JP')).toBe('700 32px Noto Sans JP')
  })
})

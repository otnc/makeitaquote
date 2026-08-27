import { describe, expect, it } from 'vitest'
import { ValidationError } from '../core/errors'
import { themes } from './presets'
import { defineTheme, toPixels } from './resolve'

describe('defineTheme', () => {
  it('defaults to dark', () => {
    expect(defineTheme().background).toBe('#000000')
  })

  it('returns a preset by name', () => {
    expect(defineTheme('light').background).toBe('#FFFFFF')
    expect(defineTheme('custom').background).toBe('transparent')
  })

  it('keeps the avatar in color via an explicit override', () => {
    expect(defineTheme({ avatar: { grayscale: false } }).avatar.grayscale).toBe(false)
  })

  it('combines a palette with a stacked layout', () => {
    const theme = defineTheme({ extends: 'light', layout: 'new' })

    expect(theme.layout).toBe('new')
    expect(theme.background).toBe('#FFFFFF')
    expect(theme.avatar.widthRatio).toBe(1)
  })

  it('defaults to the dark palette for a bare layout override', () => {
    const theme = defineTheme({ layout: 'new' })

    expect(theme.background).toBe('#000000')
    expect(theme.avatar.widthRatio).toBe(1)
  })

  it('has a stacked custom preset too', () => {
    const theme = defineTheme({ extends: 'custom', layout: 'new' })

    expect(theme.background).toBe('transparent')
    expect(theme.avatar.widthRatio).toBe(1)
  })

  it('rejects an unknown preset name', () => {
    expect(() => defineTheme('neon' as 'dark')).toThrow(ValidationError)
  })

  it('never hands out the preset object itself', () => {
    const theme = defineTheme('dark')
    theme.background = '#123456'

    expect(themes.dark.side.background).toBe('#000000')
  })

  it('deep-copies nested objects too', () => {
    const theme = defineTheme('dark')
    theme.text.color = '#123456'

    expect(themes.dark.side.text.color).toBe('#FFFFFF')
  })

  it('merges a shallow override', () => {
    expect(defineTheme({ background: '#FF0000' }).background).toBe('#FF0000')
  })

  it('merges a nested override without dropping its siblings', () => {
    const theme = defineTheme({ text: { color: '#FF0000' } })

    expect(theme.text.color).toBe('#FF0000')
    expect(theme.text.lineHeight).toBe(themes.dark.side.text.lineHeight)
    expect(theme.text.font).toBe(themes.dark.side.text.font)
  })

  it('extends the named preset', () => {
    const theme = defineTheme({ extends: 'light', background: '#FFF8E7' })

    expect(theme.background).toBe('#FFF8E7')
    expect(theme.text.color).toBe('#111111')
  })

  it('rejects an unknown preset in extends', () => {
    expect(() => defineTheme({ extends: 'neon' as 'dark' })).toThrow(ValidationError)
  })

  it('replaces arrays wholesale rather than merging them', () => {
    const theme = defineTheme({
      gradient: {
        stops: [
          [0, 0],
          [1, 1],
        ],
      },
    })

    expect(theme.gradient.stops).toEqual([
      [0, 0],
      [1, 1],
    ])
  })

  it('switches off the quote marks', () => {
    expect(defineTheme({ quoteMark: { display: 'none' } }).quoteMark.display).toBe('none')
  })

  it('keeps the other quote mark settings when only display changes', () => {
    const theme = defineTheme({ quoteMark: { display: 'block' } })

    expect(theme.quoteMark.chars).toEqual(['“', '”'])
  })

  it('rejects an unknown property, rather than silently ignoring it', () => {
    // A near-miss on a real property is exactly the typo worth catching.
    expect(() => defineTheme({ backgroundColor: '#FFF' } as object)).toThrow(ValidationError)
  })

  it('names the property it rejected, including its path', () => {
    // `tint` isn't a real property anywhere in Theme — the point is only that
    // the path prefix (`theme.text.`) comes through, not the property itself.
    expect(() => defineTheme({ text: { tint: '#FFF' } } as object)).toThrow(/theme\.text\.tint/)
  })

  it('ignores explicit undefined', () => {
    expect(defineTheme({ background: undefined }).background).toBe('#000000')
  })

  describe('validation', () => {
    it('rejects a non-positive size', () => {
      expect(() => defineTheme({ width: 0 })).toThrow(ValidationError)
      expect(() => defineTheme({ height: -1 })).toThrow(ValidationError)
    })

    it('rejects an avatar wider than the canvas', () => {
      expect(() => defineTheme({ avatar: { widthRatio: 1.5 } })).toThrow(ValidationError)
    })

    it('rejects an unknown layout', () => {
      expect(() => defineTheme({ layout: 'grid' as never })).toThrow(ValidationError)
    })

    it('rejects a minimum font size above the maximum', () => {
      expect(() => defineTheme({ text: { size: 0.05, minSize: 0.06 } })).toThrow(ValidationError)
    })

    it('rejects a malformed quote pair', () => {
      expect(() => defineTheme({ text: { quotes: ['“'] } as object })).toThrow(ValidationError)
    })

    it('rejects an unknown avatar shape', () => {
      expect(() => defineTheme({ avatar: { shape: 'hexagon' as never } })).toThrow(ValidationError)
    })

    it('rejects an unknown backgroundImage fit', () => {
      expect(() =>
        defineTheme({
          backgroundImage: { source: 'a.png', fit: 'stretch' as never, opacity: 1 },
        }),
      ).toThrow(ValidationError)
    })

    it('rejects a backgroundImage opacity outside 0-1', () => {
      expect(() =>
        defineTheme({ backgroundImage: { source: 'a.png', fit: 'cover', opacity: 1.5 } }),
      ).toThrow(ValidationError)
    })

    it('rejects an unknown backgroundGradient type', () => {
      expect(() =>
        defineTheme({
          backgroundGradient: {
            type: 'conic' as never,
            direction: 'diagonal',
            stops: [
              ['#000', 0],
              ['#FFF', 1],
            ],
          },
        }),
      ).toThrow(ValidationError)
    })

    it('rejects an unknown backgroundGradient direction', () => {
      expect(() =>
        defineTheme({
          backgroundGradient: {
            type: 'linear',
            direction: 'upward' as never,
            stops: [
              ['#000', 0],
              ['#FFF', 1],
            ],
          },
        }),
      ).toThrow(ValidationError)
    })

    it('rejects a backgroundGradient with fewer than two stops', () => {
      expect(() =>
        defineTheme({
          backgroundGradient: { type: 'linear', direction: 'horizontal', stops: [['#000', 0]] },
        }),
      ).toThrow(ValidationError)
    })
  })

  it('leaves backgroundImage null by default', () => {
    expect(defineTheme().backgroundImage).toBeNull()
  })

  it('leaves backgroundGradient null by default', () => {
    expect(defineTheme().backgroundGradient).toBeNull()
  })

  it('accepts a backgroundGradient', () => {
    const theme = defineTheme({
      backgroundGradient: {
        type: 'linear',
        direction: 'diagonal',
        stops: [
          ['#FF7E5F', 0],
          ['#6A3093', 1],
        ],
      },
    })

    expect(theme.backgroundGradient).toEqual({
      type: 'linear',
      direction: 'diagonal',
      stops: [
        ['#FF7E5F', 0],
        ['#6A3093', 1],
      ],
    })
  })

  it('accepts a full backgroundImage object', () => {
    const theme = defineTheme({
      backgroundImage: { source: 'https://cdn.test/bg.png', fit: 'contain', opacity: 0.5 },
    })

    expect(theme.backgroundImage).toEqual({
      source: 'https://cdn.test/bg.png',
      fit: 'contain',
      opacity: 0.5,
    })
  })

  describe('font aliases', () => {
    it('resolves an alias in every font field', () => {
      const theme = defineTheme({
        text: { font: 'pop' },
        displayName: { font: 'dot' },
        username: { font: 'dela' },
        watermark: { font: 'rampart' },
      })

      expect(theme.text.font).toBe('Hachi Maru Pop')
      expect(theme.displayName.font).toBe('DotGothic16')
      expect(theme.username.font).toBe('Dela Gothic One')
      expect(theme.watermark.font).toBe('Rampart One')
    })

    it('resolves each family in a stack independently', () => {
      const theme = defineTheme({ text: { font: 'pop, dot, sans-serif' } })

      expect(theme.text.font).toBe('Hachi Maru Pop, DotGothic16, sans-serif')
    })

    it('leaves a font the caller registered themselves untouched', () => {
      const theme = defineTheme({ text: { font: 'My Custom Font' } })

      expect(theme.text.font).toBe('My Custom Font')
    })

    it('never turns the generic "serif" keyword into Zen Old Mincho', () => {
      const theme = defineTheme({ text: { font: 'Vina Sans, serif' } })

      expect(theme.text.font).toBe('Vina Sans, serif')
    })
  })
})

describe('toPixels', () => {
  it('treats a fraction as a share of the basis', () => {
    expect(toPixels(0.5, 720)).toBe(360)
  })

  it('treats 1 as the whole basis', () => {
    expect(toPixels(1, 720)).toBe(720)
  })

  it('treats anything larger as pixels', () => {
    expect(toPixels(45, 720)).toBe(45)
  })
})

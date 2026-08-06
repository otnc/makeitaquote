import { describe, expect, it } from 'vitest'
import { ValidationError } from '../core/errors'
import { isTransparent, parseColor, toCSS, toHex, withAlpha } from './color'

const RED = { r: 255, g: 0, b: 0, a: 1 }

describe('parseColor', () => {
  describe('hex strings', () => {
    it('reads #RRGGBB', () => {
      expect(parseColor('#FF0000')).toEqual(RED)
    })

    it('reads #RRGGBBAA', () => {
      expect(parseColor('#FF000080')).toMatchObject({ r: 255, g: 0, b: 0 })
      expect(parseColor('#FF000080').a).toBeCloseTo(0.502, 2)
    })

    it('reads #RGB', () => {
      expect(parseColor('#F00')).toEqual(RED)
    })

    it('reads #RGBA', () => {
      expect(parseColor('#F000').a).toBe(0)
    })

    it('is case-insensitive', () => {
      expect(parseColor('#ff0000')).toEqual(parseColor('#FF0000'))
    })

    it('tolerates surrounding whitespace', () => {
      expect(parseColor('  #FF0000  ')).toEqual(RED)
    })
  })

  describe('numbers', () => {
    it('reads 0xRRGGBB as opaque', () => {
      expect(parseColor(0xff0000)).toEqual(RED)
    })

    it('reads 0xRRGGBBAA', () => {
      expect(parseColor(0xff0000ff)).toEqual(RED)
      expect(parseColor(0xff000080).a).toBeCloseTo(0.502, 2)
    })

    it('cannot see a leading zero byte, so use a string for those', () => {
      // 0x00FF0000 and 0xFF0000 are the same number; nothing can tell them
      // apart. The string form carries its own length and is unambiguous.
      expect(parseColor(0x00ff0000)).toEqual(RED)
      expect(parseColor('#00FF0000')).toEqual({ r: 0, g: 255, b: 0, a: 0 })
    })

    it('treats 0x000000 as opaque black', () => {
      expect(parseColor(0x000000)).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    })

    it('reads a 0x string too', () => {
      expect(parseColor('0xFF0000')).toEqual(RED)
    })

    it('rejects a non-integer', () => {
      expect(() => parseColor(1.5)).toThrow(ValidationError)
    })

    it('rejects out-of-range numbers', () => {
      expect(() => parseColor(-1)).toThrow(ValidationError)
      expect(() => parseColor(0x1_0000_0000)).toThrow(ValidationError)
    })
  })

  describe('arrays', () => {
    it('reads [r, g, b]', () => {
      expect(parseColor([255, 0, 0])).toEqual(RED)
    })

    it('reads [r, g, b, a] with alpha 0–1', () => {
      expect(parseColor([255, 0, 0, 0.5]).a).toBe(0.5)
    })

    it('reads [r, g, b, a] with alpha 0–255', () => {
      expect(parseColor([255, 0, 0, 128]).a).toBeCloseTo(0.502, 2)
    })

    it('reads alpha 1 as fully opaque', () => {
      expect(parseColor([255, 0, 0, 1]).a).toBe(1)
    })

    it('reads alpha 0 as fully transparent', () => {
      expect(parseColor([255, 0, 0, 0]).a).toBe(0)
    })

    it('clamps channels', () => {
      expect(parseColor([300, -20, 0])).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    })

    it('rejects the wrong number of channels', () => {
      expect(() => parseColor([255, 0])).toThrow(ValidationError)
      expect(() => parseColor([255, 0, 0, 1, 1])).toThrow(ValidationError)
    })
  })

  describe('keywords and functions', () => {
    it('reads transparent', () => {
      expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 })
      expect(parseColor('TRANSPARENT').a).toBe(0)
    })

    it('reads rgb()', () => {
      expect(parseColor('rgb(255, 0, 0)')).toEqual(RED)
    })

    it('reads rgba()', () => {
      expect(parseColor('rgba(255, 0, 0, 0.5)').a).toBe(0.5)
    })

    it('reads a percentage alpha', () => {
      expect(parseColor('rgba(255, 0, 0, 50%)').a).toBe(0.5)
    })
  })

  describe('the rest of CSS, via culori', () => {
    it('reads a colour name', () => {
      expect(parseColor('rebeccapurple')).toEqual({ r: 102, g: 51, b: 153, a: 1 })
      expect(parseColor('red')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    })

    it('reads hsl(), converting to rgb', () => {
      expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    })

    // hwb() was only ever defined with space-separated arguments — unlike
    // rgb()/hsl(), it has no legacy comma form to also accept.
    it('reads hwb(), converting to rgb', () => {
      expect(parseColor('hwb(0 0% 0%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    })

    // culori parses the rest of CSS Color 4 too, which `color` (the package
    // this used to run on) did not — a real capability gained by the switch,
    // not just a like-for-like swap.
    it('reads lab(), lch(), oklab(), oklch() and color(), converting to rgb', () => {
      expect(parseColor('lab(50% 40 59.5)')).toEqual({ r: 191, g: 87, b: 0, a: 1 })
      expect(parseColor('lch(50% 60 30)')).toEqual({ r: 202, g: 73, b: 72, a: 1 })
      expect(parseColor('oklab(59% 0.1 0.1)')).toEqual({ r: 192, g: 93, b: 43, a: 1 })
      expect(parseColor('oklch(60% 0.15 30)')).toEqual({ r: 202, g: 87, b: 71, a: 1 })
      expect(parseColor('color(srgb 1 0 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    })

    it('is case-insensitive, matching CSS identifiers generally', () => {
      expect(parseColor('RED')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
      expect(parseColor('RGB(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    })

    it('reads the space-separated form with a slash alpha', () => {
      expect(parseColor('rgb(255 0 0 / 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 })
    })
  })

  it('rejects anything it cannot read, and says what it takes', () => {
    expect(() => parseColor('#GG0000')).toThrow(ValidationError)
    expect(() => parseColor('not a color')).toThrow(/0xRRGGBBAA/)
    expect(() => parseColor(null as unknown as string)).toThrow(ValidationError)
  })

  it('names the field it rejected', () => {
    expect(() => parseColor('nope', 'theme.background')).toThrow(/theme\.background/)
  })
})

describe('toCSS', () => {
  it('omits the alpha channel when opaque', () => {
    expect(toCSS(RED)).toBe('rgb(255, 0, 0)')
  })

  it('includes it otherwise', () => {
    expect(toCSS({ ...RED, a: 0.5 })).toBe('rgba(255, 0, 0, 0.5)')
  })

  it('round-trips through parseColor', () => {
    for (const input of ['#FF000080', 0xff0000_80, [255, 0, 0, 0.5]] as const) {
      const parsed = parseColor(input)
      expect(parseColor(toCSS(parsed)).r).toBe(parsed.r)
    }
  })
})

describe('withAlpha', () => {
  it('scales the existing alpha', () => {
    expect(withAlpha(RED, 0.5)).toBe('rgba(255, 0, 0, 0.5)')
    expect(withAlpha({ ...RED, a: 0.5 }, 0.5)).toBe('rgba(255, 0, 0, 0.25)')
  })

  it('stays transparent when the color is', () => {
    expect(withAlpha({ ...RED, a: 0 }, 1)).toBe('rgba(255, 0, 0, 0)')
  })
})

describe('isTransparent', () => {
  it('is true only at zero alpha', () => {
    expect(isTransparent(parseColor('transparent'))).toBe(true)
    expect(isTransparent(parseColor('#00000000'))).toBe(true)
    expect(isTransparent(parseColor('#00000001'))).toBe(false)
  })
})

describe('toHex', () => {
  it('normalizes to #RRGGBBAA', () => {
    expect(toHex(parseColor('#F00'))).toBe('#FF0000FF')
    expect(toHex(parseColor([0, 0, 0, 0]))).toBe('#00000000')
  })
})

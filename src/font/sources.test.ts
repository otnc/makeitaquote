import { describe, expect, it } from 'vitest'
import { DEFAULT_FONT_FAMILIES, FALLBACK_FAMILY } from './sources'

describe('DEFAULT_FONT_FAMILIES', () => {
  it('leads with the house font, Noto Sans JP as the general CJK safety net', () => {
    expect(DEFAULT_FONT_FAMILIES[0]).toBe('M PLUS Rounded 1c')
    expect(DEFAULT_FONT_FAMILIES[1]).toBe('Noto Sans JP')
  })

  it('covers Korean, Traditional Chinese, Simplified Chinese and Arabic too', () => {
    expect(DEFAULT_FONT_FAMILIES).toContain('Nanum Gothic')
    expect(DEFAULT_FONT_FAMILIES).toContain('Chiron GoRound TC')
    expect(DEFAULT_FONT_FAMILIES).toContain('Noto Sans SC')
    expect(DEFAULT_FONT_FAMILIES).toContain('IBM Plex Sans Arabic')
  })

  it('prioritises traditional-style glyphs over simplified ones', () => {
    const traditional = DEFAULT_FONT_FAMILIES.indexOf('Chiron GoRound TC')
    const simplified = DEFAULT_FONT_FAMILIES.indexOf('Noto Sans SC')
    expect(traditional).toBeLessThan(simplified)
  })
})

describe('FALLBACK_FAMILY', () => {
  it('is the generic CSS keyword every stack ends on', () => {
    expect(FALLBACK_FAMILY).toBe('sans-serif')
  })
})

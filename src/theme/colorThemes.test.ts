import { describe, expect, it } from 'vitest'
import {
  COLOR_THEME_ALIASES,
  COLOR_THEME_CATALOGUE,
  colorThemeGradient,
  colorThemeTextBase,
  resolveColorTheme,
} from './colorThemes'

describe('COLOR_THEME_CATALOGUE', () => {
  it('lists all 21 official color themes', () => {
    expect(COLOR_THEME_CATALOGUE).toHaveLength(21)
  })

  it('has no duplicate keys', () => {
    const keys = COLOR_THEME_CATALOGUE.map((theme) => theme.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('carries the exact gradient and text base for a known theme', () => {
    const midnightBlurple = COLOR_THEME_CATALOGUE.find((theme) => theme.key === 'midnight_blurple')
    expect(midnightBlurple).toMatchObject({
      label: 'Midnight Blurple',
      gradient: ['#4550BD', '#151738'],
      textBase: 'dark',
      alias: 'mb',
    })
  })

  it('has null, not a missing field, for a theme with no alias', () => {
    const forest = COLOR_THEME_CATALOGUE.find((theme) => theme.key === 'forest')
    expect(forest?.alias).toBeNull()
  })
})

describe('COLOR_THEME_ALIASES', () => {
  it('maps every alias to a catalogued key', () => {
    const keys = new Set(COLOR_THEME_CATALOGUE.map((theme) => theme.key))
    for (const key of Object.values(COLOR_THEME_ALIASES)) {
      expect(keys.has(key)).toBe(true)
    }
  })

  it('matches the official bot option names', () => {
    expect(COLOR_THEME_ALIASES.mb).toBe('midnight_blurple')
    expect(COLOR_THEME_ALIASES.ma).toBe('mint_apple')
  })

  it('has no entry for a theme with no official short alias', () => {
    expect(Object.values(COLOR_THEME_ALIASES)).not.toContain('forest')
  })
})

describe('resolveColorTheme', () => {
  it('resolves an alias', () => {
    expect(resolveColorTheme('mb')).toBe('midnight_blurple')
  })

  it('is case-insensitive for aliases', () => {
    expect(resolveColorTheme('MB')).toBe('midnight_blurple')
  })

  it('accepts the exact key', () => {
    expect(resolveColorTheme('midnight_blurple')).toBe('midnight_blurple')
  })

  it('accepts the key with underscores dropped', () => {
    expect(resolveColorTheme('midnightblurple')).toBe('midnight_blurple')
  })

  it('is case-insensitive for keys', () => {
    expect(resolveColorTheme('MIDNIGHT_BLURPLE')).toBe('midnight_blurple')
  })

  it('is undefined for anything neither table recognizes', () => {
    expect(resolveColorTheme('not-a-theme')).toBeUndefined()
    expect(resolveColorTheme('')).toBeUndefined()
  })
})

describe('colorThemeGradient', () => {
  it('builds a diagonal linear backgroundGradient from the two stops', () => {
    expect(colorThemeGradient('midnight_blurple')).toEqual({
      type: 'linear',
      direction: 'diagonal',
      stops: [
        ['#4550BD', 0],
        ['#151738', 1],
      ],
    })
  })

  it('is undefined for an unresolved key', () => {
    expect(colorThemeGradient('not-a-theme')).toBeUndefined()
  })
})

describe('colorThemeTextBase', () => {
  it('is dark for a rich gradient', () => {
    expect(colorThemeTextBase('midnight_blurple')).toBe('dark')
  })

  it('is light for a pale gradient', () => {
    expect(colorThemeTextBase('mint_apple')).toBe('light')
  })

  it('is undefined for an unresolved key', () => {
    expect(colorThemeTextBase('not-a-theme')).toBeUndefined()
  })
})

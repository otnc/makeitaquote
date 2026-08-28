import { describe, expect, it } from 'vitest'
import {
  ALL_COLOR_THEME_ALIASES,
  ALL_COLOR_THEME_CATALOGUE,
  COLOR_THEME_ALIASES,
  COLOR_THEME_CATALOGUE,
  CUSTOM_COLOR_THEME_ALIASES,
  CUSTOM_COLOR_THEME_CATALOGUE,
  colorThemeGradient,
  colorThemeTextBase,
  resolveColorTheme,
} from './colorThemes'

describe('COLOR_THEME_CATALOGUE', () => {
  it('lists all 21 color themes', () => {
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

  it('has the expected short names', () => {
    expect(COLOR_THEME_ALIASES.mb).toBe('midnight_blurple')
    expect(COLOR_THEME_ALIASES.ma).toBe('mint_apple')
  })

  it('has no entry for a theme with no short alias', () => {
    expect(Object.values(COLOR_THEME_ALIASES)).not.toContain('forest')
  })
})

describe('CUSTOM_COLOR_THEME_CATALOGUE', () => {
  it('lists 18 color themes', () => {
    expect(CUSTOM_COLOR_THEME_CATALOGUE).toHaveLength(18)
  })

  it('has no duplicate keys, and none shared with COLOR_THEME_CATALOGUE', () => {
    const officialKeys = new Set(COLOR_THEME_CATALOGUE.map((theme) => theme.key))
    const customKeys = CUSTOM_COLOR_THEME_CATALOGUE.map((theme) => theme.key)

    expect(new Set(customKeys).size).toBe(customKeys.length)
    for (const key of customKeys) {
      expect(officialKeys.has(key)).toBe(false)
    }
  })

  it('carries the exact gradient and text base for a known theme', () => {
    const tokyoNight = CUSTOM_COLOR_THEME_CATALOGUE.find((theme) => theme.key === 'tokyo_night')
    expect(tokyoNight).toMatchObject({
      label: 'Tokyo Night',
      gradient: ['#1A1B26', '#565F89'],
      textBase: 'dark',
      alias: 'tokyo',
    })
  })

  it('gives every alias at least 4 characters', () => {
    for (const theme of CUSTOM_COLOR_THEME_CATALOGUE) {
      if (theme.alias !== null) expect(theme.alias.length).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('ALL_COLOR_THEME_CATALOGUE', () => {
  it('is COLOR_THEME_CATALOGUE followed by CUSTOM_COLOR_THEME_CATALOGUE', () => {
    expect(ALL_COLOR_THEME_CATALOGUE).toEqual([
      ...COLOR_THEME_CATALOGUE,
      ...CUSTOM_COLOR_THEME_CATALOGUE,
    ])
  })

  it('has no duplicate keys across both catalogues', () => {
    const keys = ALL_COLOR_THEME_CATALOGUE.map((theme) => theme.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('CUSTOM_COLOR_THEME_ALIASES', () => {
  it('maps every alias to a custom catalogue key', () => {
    const keys = new Set(CUSTOM_COLOR_THEME_CATALOGUE.map((theme) => theme.key))
    for (const key of Object.values(CUSTOM_COLOR_THEME_ALIASES)) {
      expect(keys.has(key)).toBe(true)
    }
  })

  it('has the expected short name', () => {
    expect(CUSTOM_COLOR_THEME_ALIASES.tokyo).toBe('tokyo_night')
  })

  it('shares no alias with COLOR_THEME_ALIASES', () => {
    const officialAliases = new Set(Object.keys(COLOR_THEME_ALIASES))
    for (const alias of Object.keys(CUSTOM_COLOR_THEME_ALIASES)) {
      expect(officialAliases.has(alias)).toBe(false)
    }
  })
})

describe('ALL_COLOR_THEME_ALIASES', () => {
  it('merges both alias tables', () => {
    expect(ALL_COLOR_THEME_ALIASES).toEqual({
      ...COLOR_THEME_ALIASES,
      ...CUSTOM_COLOR_THEME_ALIASES,
    })
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

  it('resolves a custom catalogue alias and key too', () => {
    expect(resolveColorTheme('tokyo')).toBe('tokyo_night')
    expect(resolveColorTheme('tokyo_night')).toBe('tokyo_night')
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

  it('works for a custom catalogue key too', () => {
    expect(colorThemeGradient('tokyo_night')).toEqual({
      type: 'linear',
      direction: 'diagonal',
      stops: [
        ['#1A1B26', 0],
        ['#565F89', 1],
      ],
    })
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

  it('works for a custom catalogue key too', () => {
    expect(colorThemeTextBase('tokyo_night')).toBe('dark')
    expect(colorThemeTextBase('arctic_blue')).toBe('light')
  })
})

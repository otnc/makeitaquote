import { describe, expect, it } from 'vitest'
import {
  FONT_ALIASES,
  FONT_CATALOGUE,
  GENERIC_FONT_FAMILIES,
  isCatalogued,
  resolveFontAlias,
  resolveFontStack,
  suggestionFor,
  unavailableReason,
} from './catalogue'

describe('isCatalogued', () => {
  it('matches a listed family exactly', () => {
    expect(isCatalogued('Noto Sans JP')).toBe(true)
    expect(isCatalogued('DotGothic16')).toBe(true)
    expect(isCatalogued('Castoro Titling')).toBe(true)
  })

  it('includes the script-fallback fonts', () => {
    expect(isCatalogued('Noto Sans SC')).toBe(true)
    expect(isCatalogued('Nanum Gothic')).toBe(true)
    expect(isCatalogued('IBM Plex Sans Arabic')).toBe(true)
  })

  it('is exact — spelling and case both count', () => {
    expect(isCatalogued('noto sans jp')).toBe(false)
    expect(isCatalogued('Helvetica')).toBe(false)
  })
})

describe('unavailableReason', () => {
  it('names why a known-missing family cannot be fetched', () => {
    expect(unavailableReason('Jiyu no Tsubasa')).toContain('licence is unclear')
  })

  it('ignores surrounding space and case', () => {
    expect(unavailableReason('  JIYU NO TSUBASA ')).toBeDefined()
  })

  it('is undefined for anything else', () => {
    expect(unavailableReason('Noto Sans JP')).toBeUndefined()
  })
})

describe('suggestionFor', () => {
  it('corrects an ordinary typo', () => {
    expect(suggestionFor('dacing script')).toBe('Dancing Script')
    expect(suggestionFor('Dela Gothic Oen')).toBe('Dela Gothic One')
    expect(suggestionFor('Yusei Magik')).toBe('Yusei Magic')
    expect(suggestionFor('Inconsolatta')).toBe('Inconsolata')
  })

  it('ignores spacing and punctuation, which are where these names differ most', () => {
    expect(suggestionFor('mplus rounded 1c')).toBe('M PLUS Rounded 1c')
    expect(suggestionFor('dot gothic 16')).toBe('DotGothic16')
    expect(suggestionFor('rock n roll one')).toBe('RocknRoll One')
    expect(suggestionFor('exo2')).toBe('Exo 2')
  })

  it('still handles the rewordings edit distance alone would miss', () => {
    expect(suggestionFor('noto sans jp regular')).toBe('Noto Sans JP')
    expect(suggestionFor('m+ rounded 1c')).toBe('M PLUS Rounded 1c')
  })

  it('says nothing rather than reaching for the nearest name', () => {
    expect(suggestionFor('Helvetica')).toBeUndefined()
    expect(suggestionFor('Jiyu no Tsubasa')).toBeUndefined()
    expect(suggestionFor('zzzzzzzzzzzzzzzz')).toBeUndefined()
  })

  it('is undefined for a name with nothing to compare', () => {
    expect(suggestionFor('')).toBeUndefined()
    expect(suggestionFor('   ')).toBeUndefined()
  })
})

describe('FONT_ALIASES', () => {
  it('maps every alias to a catalogued family', () => {
    for (const family of Object.values(FONT_ALIASES)) {
      expect(FONT_CATALOGUE).toContain(family)
    }
  })

  it('matches the official bot option names', () => {
    expect(FONT_ALIASES.pop).toBe('Hachi Maru Pop')
    expect(FONT_ALIASES.dot).toBe('DotGothic16')
    expect(FONT_ALIASES.castoro).toBe('Castoro Titling')
  })

  it('has the one addition, sans, for the default font', () => {
    expect(FONT_ALIASES.sans).toBe('Noto Sans JP')
  })

  it("has no alias for the script-fallback fonts — not one of the bot's font= choices", () => {
    expect(Object.values(FONT_ALIASES)).not.toContain('Noto Sans SC')
    expect(Object.values(FONT_ALIASES)).not.toContain('Nanum Gothic')
    expect(Object.values(FONT_ALIASES)).not.toContain('IBM Plex Sans Arabic')
  })
})

describe('resolveFontAlias', () => {
  it('resolves an alias', () => {
    expect(resolveFontAlias('pop')).toBe('Hachi Maru Pop')
  })

  it('is case-insensitive for aliases', () => {
    expect(resolveFontAlias('POP')).toBe('Hachi Maru Pop')
  })

  it('also accepts a catalogued family name, in any case', () => {
    expect(resolveFontAlias('DotGothic16')).toBe('DotGothic16')
    expect(resolveFontAlias('dotgothic16')).toBe('DotGothic16')
  })

  it('trims surrounding space', () => {
    expect(resolveFontAlias('  pop  ')).toBe('Hachi Maru Pop')
  })

  it('is undefined for anything neither table recognizes', () => {
    expect(resolveFontAlias('not-a-font')).toBeUndefined()
    expect(resolveFontAlias('')).toBeUndefined()
    expect(resolveFontAlias('   ')).toBeUndefined()
  })
})

describe('resolveFontStack', () => {
  it('resolves an alias standing alone', () => {
    expect(resolveFontStack('pop')).toBe('Hachi Maru Pop')
  })

  it('resolves each family in a stack independently', () => {
    expect(resolveFontStack('pop, dot, sans-serif')).toBe('Hachi Maru Pop, DotGothic16, sans-serif')
  })

  it('leaves anything neither table recognizes untouched, just trimmed', () => {
    expect(resolveFontStack('  Custom Font  , pop')).toBe('Custom Font, Hachi Maru Pop')
  })

  it('never resolves a generic keyword, even one that is also an alias key', () => {
    expect(FONT_ALIASES.serif).toBe('Zen Old Mincho')
    expect(resolveFontStack('Vina Sans, serif')).toBe('Vina Sans, serif')
  })

  it('strips quotes around a family name', () => {
    expect(resolveFontStack(`"Vina Sans", 'pop'`)).toBe('Vina Sans, Hachi Maru Pop')
  })
})

describe('GENERIC_FONT_FAMILIES', () => {
  it('lists the CSS generic keywords', () => {
    expect(GENERIC_FONT_FAMILIES.has('sans-serif')).toBe(true)
    expect(GENERIC_FONT_FAMILIES.has('serif')).toBe(true)
    expect(GENERIC_FONT_FAMILIES.has('monospace')).toBe(true)
    expect(GENERIC_FONT_FAMILIES.has('cursive')).toBe(true)
    expect(GENERIC_FONT_FAMILIES.has('fantasy')).toBe(true)
  })
})

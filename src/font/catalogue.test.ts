import { describe, expect, it } from 'vitest'
import { isCatalogued, suggestionFor, unavailableReason } from './catalogue'

describe('isCatalogued', () => {
  it('matches a listed family exactly', () => {
    expect(isCatalogued('Noto Sans JP')).toBe(true)
    expect(isCatalogued('DotGothic16')).toBe(true)
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
    expect(unavailableReason('  CASTOR TITLING ')).toBeDefined()
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

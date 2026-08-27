import { describe, expect, it } from 'vitest'
import { needsGlyphFallback } from './glyphs'

describe('needsGlyphFallback', () => {
  it('is false for Latin-only text', () => {
    expect(needsGlyphFallback('Hello World!')).toBe(false)
  })

  it('is true for Japanese', () => {
    expect(needsGlyphFallback('吾輩は猫である')).toBe(true)
  })

  it('is true for Korean (Hangul) — see #59', () => {
    expect(needsGlyphFallback('안녕하세요')).toBe(true)
  })

  it('is true for Arabic — see #59', () => {
    expect(needsGlyphFallback('مرحبا')).toBe(true)
  })

  it('is true for Simplified Chinese — see #59', () => {
    expect(needsGlyphFallback('你好，世界')).toBe(true)
  })
})

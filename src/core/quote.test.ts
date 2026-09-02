import { describe, expect, it } from 'vitest'
import { ValidationError } from './errors'
import {
  applyInput,
  emptyQuote,
  normalizeWatermarkInput,
  resolveMarkdownMode,
  resolveQuoteText,
  translateLegacyStrip,
} from './quote'

describe('resolveMarkdownMode', () => {
  it('picks the first defined candidate', () => {
    expect(resolveMarkdownMode(['discord', undefined], 'raw')).toBe('discord')
    expect(resolveMarkdownMode([undefined, 'misskey'], 'raw')).toBe('misskey')
  })

  it('treats false as defined, not as a reason to keep looking', () => {
    expect(resolveMarkdownMode([false, 'discord'], 'raw')).toBe(false)
  })

  it('falls back when every candidate is undefined', () => {
    expect(resolveMarkdownMode([undefined, undefined], 'raw')).toBe('raw')
  })
})

describe('translateLegacyStrip', () => {
  it('leaves undefined as undefined, deferring to the next fallback', () => {
    expect(translateLegacyStrip(undefined)).toBeUndefined()
  })

  it('maps true to false (strip)', () => {
    expect(translateLegacyStrip(true)).toBe(false)
  })

  it('maps false to raw (quote exactly as written)', () => {
    expect(translateLegacyStrip(false)).toBe('raw')
  })
})

describe('resolveQuoteText', () => {
  it('strips immediately and reports raw when mode is false', () => {
    const result = resolveQuoteText('**bold**', false, () => 'bold')

    expect(result).toEqual({ text: 'bold', markdown: 'raw' })
  })

  it('passes text through untouched for every other mode', () => {
    for (const mode of ['raw', true, 'discord', 'misskey', 'twitter'] as const) {
      const result = resolveQuoteText('**bold**', mode, () => 'bold')
      expect(result).toEqual({ text: '**bold**', markdown: mode })
    }
  })
})

describe('applyInput markdown handling', () => {
  it('defaults a fresh quote to raw', () => {
    expect(emptyQuote().markdown).toBe('raw')
  })

  it('leaves markdown untouched when neither text nor markdown is given', () => {
    const target = { ...emptyQuote(), text: '**bold**', markdown: 'discord' as const }
    const next = applyInput(target, { username: 'someone' })

    expect(next.text).toBe('**bold**')
    expect(next.markdown).toBe('discord')
  })

  it('strips the new text immediately when markdown is false', () => {
    const next = applyInput(emptyQuote(), { text: '**bold**', markdown: false })

    expect(next.text).toBe('bold')
    expect(next.markdown).toBe('raw')
  })

  it('keeps text raw and defers a render mode to render time', () => {
    const next = applyInput(emptyQuote(), { text: '**bold**', markdown: 'discord' })

    expect(next.text).toBe('**bold**')
    expect(next.markdown).toBe('discord')
  })

  it('re-interprets the existing text when only markdown changes', () => {
    const target = { ...emptyQuote(), text: '**bold**' }
    const next = applyInput(target, { markdown: false })

    expect(next.text).toBe('bold')
    expect(next.markdown).toBe('raw')
  })

  it('falls back to the global default when markdown is not given', () => {
    const next = applyInput(emptyQuote(), { text: '**bold**' }, 'discord')

    expect(next.text).toBe('**bold**')
    expect(next.markdown).toBe('discord')
  })

  it('lets an explicit markdown option win over the global default', () => {
    const next = applyInput(emptyQuote(), { text: '**bold**', markdown: 'raw' }, 'discord')

    expect(next.text).toBe('**bold**')
    expect(next.markdown).toBe('raw')
  })
})

describe('normalizeWatermarkInput', () => {
  it('treats a string as text', () => {
    expect(normalizeWatermarkInput('Make it a Quote')).toEqual({
      watermark: 'Make it a Quote',
      watermarkImage: null,
    })
  })

  it('enforces the text length limit through normalizeWatermark', () => {
    expect(() => normalizeWatermarkInput('x'.repeat(65))).toThrow(ValidationError)
  })

  it('treats a URL as an image', () => {
    const url = new URL('https://example.test/logo.png')
    expect(normalizeWatermarkInput(url)).toEqual({ watermark: '', watermarkImage: url })
  })

  it('treats a Buffer/Uint8Array as an image', () => {
    const bytes = new Uint8Array([1, 2, 3])
    expect(normalizeWatermarkInput(bytes)).toEqual({ watermark: '', watermarkImage: bytes })
  })

  it('treats null as clearing both', () => {
    expect(normalizeWatermarkInput(null)).toEqual({ watermark: '', watermarkImage: null })
  })

  it('rejects anything else', () => {
    expect(() => normalizeWatermarkInput(42)).toThrow(ValidationError)
    expect(() => normalizeWatermarkInput({})).toThrow(ValidationError)
  })
})

describe('applyInput watermark handling', () => {
  it('sets the text half and clears any image when given a string', () => {
    const target = { ...emptyQuote(), watermarkImage: new URL('https://example.test/old.png') }
    const next = applyInput(target, { watermark: 'Make it a Quote' })

    expect(next.watermark).toBe('Make it a Quote')
    expect(next.watermarkImage).toBeNull()
  })

  it('sets the image half and clears any text when given an image source', () => {
    const url = new URL('https://example.test/logo.png')
    const next = applyInput({ ...emptyQuote(), watermark: 'old text' }, { watermark: url })

    expect(next.watermark).toBe('')
    expect(next.watermarkImage).toBe(url)
  })

  it('leaves the watermark untouched when not given', () => {
    const target = { ...emptyQuote(), watermark: 'kept' }
    const next = applyInput(target, { username: 'someone' })

    expect(next.watermark).toBe('kept')
  })
})

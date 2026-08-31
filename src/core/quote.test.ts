import { describe, expect, it } from 'vitest'
import {
  applyInput,
  emptyQuote,
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

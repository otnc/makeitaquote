import { describe, expect, it } from 'vitest'
import { ValidationError } from './errors'
import { fromNote } from './note'

/** A note shaped exactly as the Misskey API returns one. */
function note(overrides: Record<string, unknown> = {}) {
  return {
    id: 'x',
    text: 'こんにちは',
    cw: null,
    user: { id: 'u', username: 'otoneko', name: '音猫｡', host: null, avatarUrl: null },
    ...overrides,
  }
}

describe('fromNote', () => {
  it('reads text, name and handle from a local note, sans the theme-supplied @', () => {
    const quote = fromNote(note())

    expect(quote.text).toBe('こんにちは')
    expect(quote.username).toBe('otoneko')
    expect(quote.displayName).toBe('音猫｡')
  })

  it('takes the avatar url when there is one', () => {
    const quote = fromNote(note({ user: { username: 'a', avatarUrl: 'https://cdn.test/a.png' } }))

    expect(quote.avatar).toBe('https://cdn.test/a.png')
  })

  it('keeps the host half for a remote author — the theme adds the leading @', () => {
    const quote = fromNote(note({ user: { username: 'someone', host: 'misskey.example' } }))

    expect(quote.username).toBe('someone@misskey.example')
  })

  it('falls back to the username when the account has no display name', () => {
    const quote = fromNote(note({ user: { username: 'someone', name: null } }))

    expect(quote.displayName).toBe('someone')
  })

  it('strips MFM by default', () => {
    expect(fromNote(note({ text: '$[jelly おはよう]' })).text).toBe('おはよう')
  })

  it('leaves MFM alone when asked', () => {
    const quote = fromNote(note({ text: '$[jelly おはよう]' }), { stripMfm: false })

    expect(quote.text).toBe('$[jelly おはよう]')
  })

  it('quotes the text rather than the content warning by default', () => {
    const quote = fromNote(note({ text: 'the note', cw: 'a warning' }))

    expect(quote.text).toBe('the note')
  })

  it('quotes the content warning when asked', () => {
    const quote = fromNote(note({ text: 'the note', cw: 'a warning' }), { preferCw: true })

    expect(quote.text).toBe('a warning')
  })

  it('falls back to the other when one of text and cw is missing', () => {
    expect(fromNote(note({ text: null, cw: 'only a warning' })).text).toBe('only a warning')
    expect(fromNote(note({ text: 'only text' }), { preferCw: true }).text).toBe('only text')
  })

  it('treats a text-less note as empty rather than throwing', () => {
    expect(fromNote(note({ text: null, cw: null })).text).toBe('')
  })

  it('rejects anything that is not a note', () => {
    expect(() => fromNote(null)).toThrow(ValidationError)
    expect(() => fromNote({})).toThrow(ValidationError)
    expect(() => fromNote({ text: 'hi' })).toThrow(ValidationError)
    expect(() => fromNote({ user: {} })).toThrow(ValidationError)
  })
})

describe('the markdown option', () => {
  it('defaults to stripping, matching the historical stripMfm default', () => {
    const quote = fromNote(note({ text: '**bold** note' }))

    expect(quote.text).toBe('bold note')
    expect(quote.markdown).toBe('raw')
  })

  it('leaves the text raw when set to "raw"', () => {
    const quote = fromNote(note({ text: '**bold** note' }), { markdown: 'raw' })

    expect(quote.text).toBe('**bold** note')
    expect(quote.markdown).toBe('raw')
  })

  it('keeps the text untouched and defers a render mode to render time', () => {
    const quote = fromNote(note({ text: '**bold** note' }), { markdown: 'misskey' })

    expect(quote.text).toBe('**bold** note')
    expect(quote.markdown).toBe('misskey')
  })

  it('takes priority over the deprecated stripMfm boolean', () => {
    const quote = fromNote(note({ text: '**bold**' }), { markdown: 'raw', stripMfm: true })

    expect(quote.text).toBe('**bold**')
    expect(quote.markdown).toBe('raw')
  })

  it('falls back to the global default when neither markdown nor the legacy boolean is set', () => {
    const quote = fromNote(note({ text: '**bold**' }), {}, 'misskey')

    expect(quote.text).toBe('**bold**')
    expect(quote.markdown).toBe('misskey')
  })

  it('lets an explicit legacy boolean win over the global default', () => {
    const quote = fromNote(note({ text: '**bold**' }), { stripMfm: false }, 'misskey')

    expect(quote.text).toBe('**bold**')
    expect(quote.markdown).toBe('raw')
  })
})

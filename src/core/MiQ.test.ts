import { describe, expect, it } from 'vitest'
import { MiQ } from './MiQ'

/** A tweet shaped exactly as `TweetLike` expects one. */
function tweet(overrides: Record<string, unknown> = {}) {
  return {
    text: '**bold** tweet',
    author: { username: 'jack', name: 'jack' },
    ...overrides,
  }
}

describe('MiQ#setText markdown option', () => {
  it('defaults to raw', () => {
    const data = new MiQ().setText('**bold**').getData()

    expect(data.text).toBe('**bold**')
    expect(data.markdown).toBe('raw')
  })

  it('strips immediately when set to false', () => {
    const data = new MiQ().setText('**bold**', { markdown: false }).getData()

    expect(data.text).toBe('bold')
    expect(data.markdown).toBe('raw')
  })

  it('keeps the text raw and defers a render mode to render time', () => {
    const data = new MiQ().setText('**bold**', { markdown: 'discord' }).getData()

    expect(data.text).toBe('**bold**')
    expect(data.markdown).toBe('discord')
  })

  it('falls back to the constructor-wide default', () => {
    const data = new MiQ({ markdown: 'discord' }).setText('**bold**').getData()

    expect(data.text).toBe('**bold**')
    expect(data.markdown).toBe('discord')
  })

  it('lets the per-call option win over the constructor-wide default', () => {
    const data = new MiQ({ markdown: 'discord' }).setText('**bold**', { markdown: 'raw' }).getData()

    expect(data.text).toBe('**bold**')
    expect(data.markdown).toBe('raw')
  })
})

describe('MiQ#setFromTweet markdown option', () => {
  it('defaults to raw', () => {
    const data = new MiQ().setFromTweet(tweet()).getData()

    expect(data.text).toBe('**bold** tweet')
    expect(data.markdown).toBe('raw')
  })

  it('keeps the text untouched and defers "twitter" rendering to render time', () => {
    const data = new MiQ().setFromTweet(tweet(), { markdown: 'twitter' }).getData()

    expect(data.markdown).toBe('twitter')
  })

  it('falls back to the constructor-wide default', () => {
    const data = new MiQ({ markdown: 'twitter' }).setFromTweet(tweet()).getData()

    expect(data.markdown).toBe('twitter')
  })
})

describe('MiQ#setFromObject markdown option', () => {
  it('strips immediately when set to false', () => {
    const data = new MiQ().setFromObject({ text: '**bold**', markdown: false }).getData()

    expect(data.text).toBe('bold')
    expect(data.markdown).toBe('raw')
  })

  it('falls back to the constructor-wide default', () => {
    const data = new MiQ({ markdown: 'discord' }).setFromObject({ text: '**bold**' }).getData()

    expect(data.text).toBe('**bold**')
    expect(data.markdown).toBe('discord')
  })
})

describe('MiQ#clone', () => {
  it('preserves the markdown mode', () => {
    const original = new MiQ().setText('**bold**', { markdown: 'discord' })
    const cloned = original.clone()

    expect(cloned.getData().markdown).toBe('discord')
  })

  it('does not throw when the theme has a URL backgroundImage source', () => {
    const url = new URL('https://example.test/bg.png')
    const original = new MiQ().setTheme({
      backgroundImage: { source: url, fit: 'cover', opacity: 1 },
    })

    const cloned = original.clone()

    expect(cloned.getTheme().backgroundImage?.source).toBe(url)
  })

  it('preserves a Buffer backgroundImage source, identity included', () => {
    const bytes = Buffer.from([1, 2, 3])
    const original = new MiQ().setTheme({
      backgroundImage: { source: bytes, fit: 'cover', opacity: 1 },
    })

    const cloned = original.clone()

    expect(cloned.getTheme().backgroundImage?.source).toBe(bytes)
  })
})

describe('MiQ#getTheme', () => {
  it('does not throw when the theme has a URL backgroundImage source', () => {
    const url = new URL('https://example.test/bg.png')
    const miq = new MiQ().setTheme({ backgroundImage: { source: url, fit: 'cover', opacity: 1 } })

    expect(() => miq.getTheme()).not.toThrow()
    expect(miq.getTheme().backgroundImage?.source).toBe(url)
  })
})

describe('MiQ#setWatermark', () => {
  it('draws a string as text', () => {
    const data = new MiQ().setWatermark('Make it a Quote').getData()

    expect(data.watermark).toBe('Make it a Quote')
    expect(data.watermarkImage).toBeNull()
  })

  it('draws a URL/Buffer as an image instead, clearing the text', () => {
    const url = new URL('https://example.test/logo.png')
    const data = new MiQ().setWatermark(url).getData()

    expect(data.watermark).toBe('')
    expect(data.watermarkImage).toBe(url)
  })

  it('switching back to a string clears a previously-set image', () => {
    const data = new MiQ()
      .setWatermark(new URL('https://example.test/logo.png'))
      .setWatermark('text again')
      .getData()

    expect(data.watermark).toBe('text again')
    expect(data.watermarkImage).toBeNull()
  })
})

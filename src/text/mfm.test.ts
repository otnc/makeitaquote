import { describe, expect, it } from 'vitest'
import { stripMfm } from './mfm'

describe('stripMfm', () => {
  it('leaves plain text alone', () => {
    expect(stripMfm('nothing to strip here')).toBe('nothing to strip here')
  })

  describe('decoration functions', () => {
    it('unwraps one, dropping the function name', () => {
      expect(stripMfm('$[jelly ぷりん]')).toBe('ぷりん')
    })

    it('drops parameters too', () => {
      expect(stripMfm('$[shake.speed=1s 🍮]')).toBe('🍮')
      expect(stripMfm('$[fg.color=f00 red]')).toBe('red')
    })

    it('unwraps nested functions — the contents are parsed again', () => {
      expect(stripMfm('$[spin $[flip x]]')).toBe('x')
    })

    it('keeps the text either side', () => {
      expect(stripMfm('a $[x b] c')).toBe('a b c')
    })

    it('leaves an unclosed function as written rather than eating the rest', () => {
      expect(stripMfm('$[unclosed')).toBe('$[unclosed')
      expect(stripMfm('$[fn')).toBe('$[fn')
    })
  })

  describe('tags', () => {
    it('unwraps the inline ones wherever they appear', () => {
      expect(stripMfm('<b>bold</b>')).toBe('bold')
      expect(stripMfm('<i>x</i> <s>y</s>')).toBe('x y')
      expect(stripMfm('あ <small>ね</small>')).toBe('あ ね')
    })

    // Checked against the reference parser, misskey-dev/mfm.js: it reads
    // `<center>` as a block only at the start of a line, and as literal text
    // anywhere else.
    it('unwraps <center> when it opens a line', () => {
      expect(stripMfm('<center>middle</center>')).toBe('middle')
      expect(stripMfm('あ\n<center>ね</center>')).toBe('あ\nね')
    })

    it('leaves <center> alone mid-line, where MFM treats it as text', () => {
      expect(stripMfm('あ <center>ね</center>')).toBe('あ <center>ね</center>')
    })
  })

  describe('markdown-style markers', () => {
    it('strips bold, italic and strike', () => {
      expect(stripMfm('**bold**')).toBe('bold')
      expect(stripMfm('__bold__')).toBe('bold')
      expect(stripMfm('*italic*')).toBe('italic')
      expect(stripMfm('~~strike~~')).toBe('strike')
    })

    it('strips a quote line', () => {
      expect(stripMfm('> quoted')).toBe('quoted')
    })
  })

  describe('links', () => {
    // Unlike Discord, MFM really does render these as links, so the label is
    // what a reader saw and the URL is the part to drop.
    it('keeps the label and drops the url', () => {
      expect(stripMfm('[Misskey](https://misskey.io)')).toBe('Misskey')
    })

    it('handles the silent form the same way', () => {
      expect(stripMfm('?[silent](https://misskey.io)')).toBe('silent')
    })
  })

  describe('verbatim content', () => {
    it('keeps MFM inside inline code', () => {
      expect(stripMfm('`$[jelly x]`')).toBe('$[jelly x]')
    })

    it('keeps MFM inside a code block', () => {
      expect(stripMfm('```\n$[jelly x]\n```')).toBe('$[jelly x]')
    })

    it('unwraps maths without touching what is inside', () => {
      expect(stripMfm('\\(x^2\\)')).toBe('x^2')
    })
  })

  describe('left alone on purpose', () => {
    it('keeps custom emoji for the emoji layer to draw', () => {
      expect(stripMfm(':blobcat:')).toBe(':blobcat:')
    })

    it('keeps mentions — MFM writes those as the readable name already', () => {
      expect(stripMfm('@otoneko@misskey.example')).toBe('@otoneko@misskey.example')
      expect(stripMfm('@otoneko')).toBe('@otoneko')
    })

    it('keeps hashtags', () => {
      expect(stripMfm('#tag')).toBe('#tag')
    })
  })

  it('handles a note using several at once', () => {
    expect(stripMfm('$[jelly おはよう] :blobcat: **今日** はいい天気')).toBe(
      'おはよう :blobcat: 今日 はいい天気',
    )
  })
})

import { describe, expect, it } from 'vitest'
import { stripMarkdown } from './markdown'

describe('stripMarkdown', () => {
  it('leaves plain text alone', () => {
    expect(stripMarkdown('nothing to strip here')).toBe('nothing to strip here')
  })

  it('strips bold', () => {
    expect(stripMarkdown('**bold**')).toBe('bold')
  })

  it('strips italic, both markers', () => {
    expect(stripMarkdown('*italic*')).toBe('italic')
    expect(stripMarkdown('_italic_')).toBe('italic')
  })

  it('strips bold italic', () => {
    expect(stripMarkdown('***bold italic***')).toBe('bold italic')
  })

  it('strips strikethrough', () => {
    expect(stripMarkdown('~~strike~~')).toBe('strike')
  })

  it('strips underline', () => {
    expect(stripMarkdown('__underline__')).toBe('underline')
  })

  it('strips spoilers, revealing the text', () => {
    expect(stripMarkdown('||spoiler||')).toBe('spoiler')
  })

  it('strips inline code', () => {
    expect(stripMarkdown('`code`')).toBe('code')
  })

  describe('code spans are literal', () => {
    // Discord renders a code span verbatim, so markdown inside one is text.
    // Unwrapping the backticks first and letting the later passes see the
    // contents would silently eat it.
    it('keeps markdown inside inline code', () => {
      expect(stripMarkdown('`**not bold**`')).toBe('**not bold**')
      expect(stripMarkdown('`*x*`')).toBe('*x*')
      expect(stripMarkdown('`~~x~~`')).toBe('~~x~~')
    })

    it('keeps markdown inside a fenced block', () => {
      expect(stripMarkdown('```\n**x**\n```')).toBe('**x**')
      expect(stripMarkdown('```js\nconst a = **b**\n```')).toBe('const a = **b**')
    })

    it('still strips real markdown either side of a code span', () => {
      expect(stripMarkdown('a `**b**` c **d**')).toBe('a **b** c d')
    })

    it('keeps each of several code spans separate, in order', () => {
      expect(stripMarkdown('`**a**` then `~~b~~`')).toBe('**a** then ~~b~~')
    })

    it('leaves a backslash literal inside code, since it escapes nothing there', () => {
      expect(stripMarkdown('`\\*x\\*`')).toBe('\\*x\\*')
    })
  })

  it('strips a fenced code block, language tag included', () => {
    expect(stripMarkdown('```js\nconst a = 1\n```')).toBe('const a = 1')
  })

  it('strips a single-line fenced block', () => {
    expect(stripMarkdown('```inline block```')).toBe('inline block')
  })

  it('strips a single-line block quote', () => {
    expect(stripMarkdown('> quoted')).toBe('quoted')
  })

  it('strips a multi-line quote (>>>), keeping the rest of the message', () => {
    expect(stripMarkdown('>>> all of this\nis quoted')).toBe('all of this\nis quoted')
  })

  it('strips headers of every level Discord supports', () => {
    expect(stripMarkdown('# Header')).toBe('Header')
    expect(stripMarkdown('## Header')).toBe('Header')
    expect(stripMarkdown('### Header')).toBe('Header')
  })

  it('nests markers of different kinds', () => {
    expect(stripMarkdown('**bold _and italic_**')).toBe('bold and italic')
  })

  it('honours a backslash escape', () => {
    expect(stripMarkdown('\\*not italic\\*')).toBe('*not italic*')
  })

  it("leaves an escaped character's own markdown-looking neighbours alone", () => {
    expect(stripMarkdown('\\_still not italic_')).toBe('_still not italic_')
  })

  it('does not touch mid-word underscores or a timestamp-shaped run of colons', () => {
    expect(stripMarkdown('snake_case_var')).toBe('snake_case_var')
    expect(stripMarkdown('12:30:45')).toBe('12:30:45')
  })

  it('leaves markdown-style links alone — Discord does not render them as links', () => {
    expect(stripMarkdown('[text](https://example.com)')).toBe('[text](https://example.com)')
  })

  it('strips emphasis inline, keeping the surrounding text', () => {
    expect(stripMarkdown('normal *emphasis* here')).toBe('normal emphasis here')
  })
})

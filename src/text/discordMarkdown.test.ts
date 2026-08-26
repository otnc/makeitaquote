import { describe, expect, it } from 'vitest'
import { stripDiscordMarkdown } from './discordMarkdown'

describe('stripDiscordMarkdown', () => {
  it('leaves plain text alone', () => {
    expect(stripDiscordMarkdown('nothing to strip here')).toBe('nothing to strip here')
  })

  it('strips bold', () => {
    expect(stripDiscordMarkdown('**bold**')).toBe('bold')
  })

  it('strips italic, both markers', () => {
    expect(stripDiscordMarkdown('*italic*')).toBe('italic')
    expect(stripDiscordMarkdown('_italic_')).toBe('italic')
  })

  it('strips bold italic', () => {
    expect(stripDiscordMarkdown('***bold italic***')).toBe('bold italic')
  })

  it('strips strikethrough', () => {
    expect(stripDiscordMarkdown('~~strike~~')).toBe('strike')
  })

  it('strips underline', () => {
    expect(stripDiscordMarkdown('__underline__')).toBe('underline')
  })

  it('strips spoilers, revealing the text', () => {
    expect(stripDiscordMarkdown('||spoiler||')).toBe('spoiler')
  })

  it('strips inline code', () => {
    expect(stripDiscordMarkdown('`code`')).toBe('code')
  })

  describe('code spans are literal', () => {
    // Discord renders a code span verbatim, so markdown inside one is text.
    // Unwrapping the backticks first and letting the later passes see the
    // contents would silently eat it.
    it('keeps markdown inside inline code', () => {
      expect(stripDiscordMarkdown('`**not bold**`')).toBe('**not bold**')
      expect(stripDiscordMarkdown('`*x*`')).toBe('*x*')
      expect(stripDiscordMarkdown('`~~x~~`')).toBe('~~x~~')
    })

    it('keeps markdown inside a fenced block', () => {
      expect(stripDiscordMarkdown('```\n**x**\n```')).toBe('**x**')
      expect(stripDiscordMarkdown('```js\nconst a = **b**\n```')).toBe('const a = **b**')
    })

    it('still strips real markdown either side of a code span', () => {
      expect(stripDiscordMarkdown('a `**b**` c **d**')).toBe('a **b** c d')
    })

    it('keeps each of several code spans separate, in order', () => {
      expect(stripDiscordMarkdown('`**a**` then `~~b~~`')).toBe('**a** then ~~b~~')
    })

    // discomd resolves `\X` escapes wherever they appear, code spans
    // included — unlike Discord's own client, where a backslash inside code
    // is literal. Accepted rather than worked around: an escaped-looking
    // code sample is a narrow case, and matching Discord exactly here would
    // mean re-introducing the stash/restore machinery this was written to
    // retire.
    it('resolves a backslash escape inside code too', () => {
      expect(stripDiscordMarkdown('`\\*x\\*`')).toBe('*x*')
    })
  })

  it('strips a fenced code block, language tag included', () => {
    expect(stripDiscordMarkdown('```js\nconst a = 1\n```')).toBe('const a = 1')
  })

  it('strips a single-line fenced block', () => {
    expect(stripDiscordMarkdown('```inline block```')).toBe('inline block')
  })

  it('strips a single-line block quote', () => {
    expect(stripDiscordMarkdown('> quoted')).toBe('quoted')
  })

  it('strips a multi-line quote (>>>), keeping the rest of the message', () => {
    expect(stripDiscordMarkdown('>>> all of this\nis quoted')).toBe('all of this\nis quoted')
  })

  it('strips headers of every level Discord supports', () => {
    expect(stripDiscordMarkdown('# Header')).toBe('Header')
    expect(stripDiscordMarkdown('## Header')).toBe('Header')
    expect(stripDiscordMarkdown('### Header')).toBe('Header')
  })

  it('strips subtext', () => {
    expect(stripDiscordMarkdown('-# fine print')).toBe('fine print')
  })

  it('does not mistake subtext for a bulleted list item', () => {
    // The list marker regex requires whitespace right after `-`; `-#` never
    // has that, so it must fall to the subtext pass instead.
    expect(stripDiscordMarkdown('-# not a list')).toBe('not a list')
  })

  describe('lists', () => {
    it('strips an unordered list marker, either character', () => {
      expect(stripDiscordMarkdown('- item')).toBe('item')
      expect(stripDiscordMarkdown('* item')).toBe('item')
    })

    it('strips an ordered list marker', () => {
      expect(stripDiscordMarkdown('1. first')).toBe('first')
      expect(stripDiscordMarkdown('12. twelfth')).toBe('twelfth')
    })

    it('keeps indentation, so a nested item still reads as nested', () => {
      expect(stripDiscordMarkdown('- top\n  - nested')).toBe('top\n  nested')
    })

    it('leaves a number followed by a decimal alone', () => {
      expect(stripDiscordMarkdown('3.14 is pi')).toBe('3.14 is pi')
    })

    it('leaves italics starting a line alone — no space after the marker', () => {
      expect(stripDiscordMarkdown('*emphasis* at line start')).toBe('emphasis at line start')
    })
  })

  it('nests markers of different kinds', () => {
    expect(stripDiscordMarkdown('**bold _and italic_**')).toBe('bold and italic')
  })

  it('honours a backslash escape', () => {
    expect(stripDiscordMarkdown('\\*not italic\\*')).toBe('*not italic*')
  })

  it("leaves an escaped character's own markdown-looking neighbours alone", () => {
    expect(stripDiscordMarkdown('\\_still not italic_')).toBe('_still not italic_')
  })

  it('does not touch a timestamp-shaped run of colons', () => {
    expect(stripDiscordMarkdown('12:30:45')).toBe('12:30:45')
  })

  // Accepted rather than worked around, same as the in-code escape above:
  // discomd treats `_x_` as italic regardless of what is on either side of
  // it, so a variable name with underscores loses them same as real italic
  // would. Narrow enough in practice not to be worth diverging from discomd
  // over.
  it('treats intraword underscores as italic, same as discomd does', () => {
    expect(stripDiscordMarkdown('snake_case_var')).toBe('snakecasevar')
  })

  it('strips a masked link down to its label', () => {
    expect(stripDiscordMarkdown('[text](https://example.com)')).toBe('text')
  })

  it('strips markdown inside a masked link label', () => {
    expect(stripDiscordMarkdown('[**bold** label](https://example.com)')).toBe('bold label')
  })

  it('strips emphasis inline, keeping the surrounding text', () => {
    expect(stripDiscordMarkdown('normal *emphasis* here')).toBe('normal emphasis here')
  })
})

import { describe, expect, it } from 'vitest'
import { parseMarkdown, stripMarkdown } from './markdown'

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

  it('strips strikethrough', () => {
    expect(stripMarkdown('~~strike~~')).toBe('strike')
  })

  it('strips inline code, keeping markdown-looking contents literal', () => {
    expect(stripMarkdown('`code`')).toBe('code')
    expect(stripMarkdown('`**not bold**`')).toBe('**not bold**')
  })

  it('strips a fenced code block, language tag included', () => {
    expect(stripMarkdown('```js\nconst a = 1\n```')).toBe('const a = 1')
  })

  it('strips headers', () => {
    expect(stripMarkdown('# Heading')).toBe('Heading')
    expect(stripMarkdown('## Heading')).toBe('Heading')
  })

  it('strips a single-line block quote', () => {
    expect(stripMarkdown('> quoted')).toBe('quoted')
  })

  it('joins a multi-paragraph block quote with a blank line, same as the source', () => {
    expect(stripMarkdown('> para one\n>\n> para two')).toBe('para one\n\npara two')
  })

  it('keeps a blank line between paragraphs', () => {
    expect(stripMarkdown('para one\n\npara two')).toBe('para one\n\npara two')
  })

  it('nests markers of different kinds', () => {
    expect(stripMarkdown('**bold _and italic_**')).toBe('bold and italic')
  })

  it('honours a backslash escape', () => {
    expect(stripMarkdown('\\*not italic\\*')).toBe('*not italic*')
  })

  describe('links and images', () => {
    it("keeps a masked link's label, drops the url", () => {
      expect(stripMarkdown('[a link](https://example.com "title")')).toBe('a link')
    })

    it("keeps an image's alt text, drops the url", () => {
      expect(stripMarkdown('![alt text](https://example.com/img.png)')).toBe('alt text')
    })

    it('strips markup inside alt text too, the same as a link label', () => {
      expect(stripMarkdown('![*italic* alt **text**](https://example.com/img.png)')).toBe(
        'italic alt text',
      )
    })

    it('resolves a reference-style link to its label', () => {
      expect(stripMarkdown('[label][ref]\n\n[ref]: https://example.com "t"')).toBe('label')
    })

    it('leaves an autolink as the bare url it already was', () => {
      expect(stripMarkdown('see <https://example.com> here')).toBe('see https://example.com here')
    })
  })

  describe('lists', () => {
    it('strips unordered and ordered markers, one item per line', () => {
      expect(stripMarkdown('- item one\n- item two')).toBe('item one\nitem two')
      expect(stripMarkdown('1. first\n2. second')).toBe('first\nsecond')
    })

    it('keeps a loose list to one item per line, same as a tight one', () => {
      expect(stripMarkdown('- item one\n\n- item two')).toBe('item one\nitem two')
    })

    it('breaks before a nested list, even though CommonMark has no blank line there', () => {
      expect(stripMarkdown('- top\n  - nested')).toBe('top\nnested')
    })

    it("keeps a task list's checked state, since that is real information", () => {
      expect(stripMarkdown('- [ ] todo\n- [x] done')).toBe('[ ] todo\n[x] done')
    })
  })

  it('renders a hard line break as one', () => {
    expect(stripMarkdown('line one\nwith a break  \nhard break')).toBe(
      'line one\nwith a break\nhard break',
    )
  })

  it('drops a horizontal rule entirely', () => {
    expect(stripMarkdown('before\n\n---\n\nafter')).toBe('before\n\nafter')
  })

  it('lays out a table as tab-separated cells', () => {
    expect(stripMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe('a\tb\n1\t2')
  })

  describe('raw HTML', () => {
    it('drops an inline tag, keeping the text around it', () => {
      expect(stripMarkdown('text with <em>raw html</em> inline')).toBe('text with raw html inline')
    })

    it('drops a block of raw HTML entirely', () => {
      expect(stripMarkdown('<div>\nraw html block\n</div>\n\nafter')).toBe('after')
    })
  })

  it('trims a trailing blank line left by an invisible construct', () => {
    // The gap before a link reference definition is real source, but the definition itself renders nothing — so nothing should trail after it.
    expect(stripMarkdown('text\n\n[ref]: https://example.com')).toBe('text')
  })
})

describe('parseMarkdown', () => {
  it('leaves plain text as one unstyled run', () => {
    expect(parseMarkdown('nothing to style')).toEqual([{ value: 'nothing to style' }])
  })

  it('tags bold, italic and strikethrough', () => {
    expect(parseMarkdown('**bold**')).toEqual([{ value: 'bold', style: { bold: true } }])
    expect(parseMarkdown('*italic*')).toEqual([{ value: 'italic', style: { italic: true } }])
    expect(parseMarkdown('~~strike~~')).toEqual([
      { value: 'strike', style: { strikethrough: true } },
    ])
  })

  it('combines nested styles', () => {
    expect(parseMarkdown('**bold _and italic_**')).toEqual([
      { value: 'bold ', style: { bold: true } },
      { value: 'and italic', style: { bold: true, italic: true } },
    ])
  })

  it('mixes styled and plain runs, in order', () => {
    expect(parseMarkdown('normal **bold** normal')).toEqual([
      { value: 'normal ' },
      { value: 'bold', style: { bold: true } },
      { value: ' normal' },
    ])
  })

  describe('raw HTML style tags', () => {
    it('renders <u> as underline — CommonMark has no native syntax for it', () => {
      expect(parseMarkdown('<u>underlined</u>')).toEqual([
        { value: 'underlined', style: { underline: true } },
      ])
    })

    it('renders <b>/<strong> as bold', () => {
      expect(parseMarkdown('<b>bold</b>')).toEqual([{ value: 'bold', style: { bold: true } }])
      expect(parseMarkdown('<strong>bold</strong>')).toEqual([
        { value: 'bold', style: { bold: true } },
      ])
    })

    it('renders <i>/<em> as italic', () => {
      expect(parseMarkdown('<i>italic</i>')).toEqual([{ value: 'italic', style: { italic: true } }])
      expect(parseMarkdown('<em>italic</em>')).toEqual([
        { value: 'italic', style: { italic: true } },
      ])
    })

    it('renders <s>/<del> as strikethrough', () => {
      expect(parseMarkdown('<s>gone</s>')).toEqual([
        { value: 'gone', style: { strikethrough: true } },
      ])
      expect(parseMarkdown('<del>gone</del>')).toEqual([
        { value: 'gone', style: { strikethrough: true } },
      ])
    })

    it('is case-insensitive', () => {
      expect(parseMarkdown('<U>underlined</U>')).toEqual([
        { value: 'underlined', style: { underline: true } },
      ])
    })

    it('combines with real markdown syntax nested inside', () => {
      expect(parseMarkdown('<u>under **and bold**</u>')).toEqual([
        { value: 'under ', style: { underline: true } },
        { value: 'and bold', style: { underline: true, bold: true } },
      ])
    })

    it('combines with real markdown syntax wrapped around it', () => {
      expect(parseMarkdown('**<u>bold underline</u>**')).toEqual([
        { value: 'bold underline', style: { bold: true, underline: true } },
      ])
    })

    it('leaves an unmatched open tag dropped, same as any other raw HTML', () => {
      expect(parseMarkdown('text <u>never closed')).toEqual([{ value: 'text never closed' }])
    })

    it('handles same-tag reopening at the right depth', () => {
      expect(parseMarkdown('<u>a<u>b</u>c</u>')).toEqual([
        { value: 'abc', style: { underline: true } },
      ])
    })

    it('ignores an unrecognized tag, same as before', () => {
      expect(parseMarkdown('text with <div>raw html</div> inline')).toEqual([
        { value: 'text with raw html inline' },
      ])
    })
  })

  it('keeps headings as structural plain text — size changes are deferred', () => {
    expect(parseMarkdown('# **Bold Heading**')).toEqual([
      { value: 'Bold Heading', style: { bold: true } },
    ])
  })
})

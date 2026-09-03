import { describe, expect, it } from 'vitest'
import { fakeMeasurer, fakeMetrics } from '../__fixtures__/measurer'
import type { Segment } from '../core/types'
import { type EmojiMetrics, segmentWidth } from './measure'
import { resolveEmojiSegments, segmentText } from './segment'
import { type Line, lineToString, wrapSegments } from './wrap'

/** Wraps a string and returns the lines as plain text. */
function wrap(text: string, maxWidth: number, options: Record<string, unknown> = {}): string[] {
  return wrapSegments(segmentText(text), {
    maxWidth,
    measurer: fakeMeasurer(10),
    metrics: fakeMetrics(20, 0),
    ...options,
  }).map(lineToString)
}

/** Measures the drawn width of each line, the same way the renderer does. */
function widths(lines: Line[], metrics: Partial<EmojiMetrics> = {}): number[] {
  const measurer = fakeMeasurer(10)
  const resolved: EmojiMetrics = { ...fakeMetrics(20, 0), ...metrics }
  return lines.map((line) =>
    line.reduce((sum, segment) => sum + segmentWidth(segment, measurer, resolved), 0),
  )
}

describe('wrapSegments', () => {
  it('leaves text that fits on one line', () => {
    expect(wrap('hello', 100)).toEqual(['hello'])
  })

  it('returns one empty line for empty input', () => {
    expect(
      wrapSegments([], { maxWidth: 100, measurer: fakeMeasurer(), metrics: fakeMetrics() }),
    ).toEqual([[]])
  })

  it('breaks at spaces', () => {
    // Each ASCII character is 10 wide, so 60 fits "ab cd" but not "ab cd ef".
    expect(wrap('ab cd ef', 60)).toEqual(['ab cd ', 'ef'])
  })

  it('honours explicit newlines regardless of width', () => {
    expect(wrap('a\nb\nc', 1000)).toEqual(['a', 'b', 'c'])
  })

  it('keeps wrapping within a paragraph that also has newlines', () => {
    expect(wrap('ab cd\nef gh', 40)).toEqual(['ab ', 'cd', 'ef ', 'gh'])
  })

  it('produces an empty line for a blank line in the input', () => {
    expect(wrap('a\n\nb', 100)).toEqual(['a', '', 'b'])
  })

  it('never exceeds maxWidth', () => {
    const lines = wrapSegments(segmentText('今日はとてもいい天気ですね。散歩に行きましょう。'), {
      maxWidth: 100,
      measurer: fakeMeasurer(10),
      metrics: fakeMetrics(20, 0),
    })

    for (const width of widths(lines)) expect(width).toBeLessThanOrEqual(100)
  })

  it('breaks Japanese at phrase boundaries when it can', () => {
    // 200 units is 10 full-width characters.
    const lines = wrap('今日は天気です', 60)

    // BudouX offers 今日は / 天気です; the break should land there rather than mid-phrase.
    expect(lines[0]).toBe('今日は')
  })

  it('falls back to character breaks when no phrase boundary fits', () => {
    const lines = wrap('今日は天気です', 40, { phraseBreak: false })

    expect(lines.every((line) => line.length <= 2)).toBe(true)
    expect(lines.join('')).toBe('今日は天気です')
  })

  it('does not leave a full stop at the start of a line', () => {
    const lines = wrap('ですます。ですます', 100)

    for (const line of lines) expect(line.startsWith('。')).toBe(false)
  })

  it('splits a word that is wider than the whole line', () => {
    const lines = wrap('aaaaaaaaaa', 30)

    expect(lines).toEqual(['aaa', 'aaa', 'aaa', 'a'])
  })

  it('splits a long URL rather than overflowing', () => {
    const lines = wrapSegments(segmentText('https://example.test/a/very/long/path/indeed'), {
      maxWidth: 100,
      measurer: fakeMeasurer(10),
      metrics: fakeMetrics(20, 0),
    })

    for (const width of widths(lines)) expect(width).toBeLessThanOrEqual(100)
    expect(lines.map(lineToString).join('')).toBe('https://example.test/a/very/long/path/indeed')
  })

  it('never splits a grapheme cluster when force-breaking', () => {
    const lines = wrap('👨‍👩‍👧‍👦👨‍👩‍👧‍👦', 20)

    for (const line of lines) {
      expect(line === '' || line === '👨‍👩‍👧‍👦').toBe(true)
    }
  })

  it('keeps all input text, in order', () => {
    const source = '今日は👼とてもいい天気<:cat:123456789012345678>ですね'
    const lines = wrap(source, 80)

    expect(lines.join('')).toBe(source)
  })

  it('counts an emoji as a square of the font size', () => {
    const segments: Segment[] = [
      { kind: 'text', value: 'ab' },
      { kind: 'emoji', source: 'twemoji', url: 'u', raw: '👼' },
      { kind: 'text', value: 'cd' },
    ]

    // 10 + 10 + 20 + 10 + 10 = 60, so 50 forces a break.
    const lines = wrapSegments(segments, {
      maxWidth: 50,
      measurer: fakeMeasurer(10),
      metrics: fakeMetrics(20, 0),
    })

    expect(lines).toHaveLength(2)
  })

  it('includes the emoji side margins in its width', () => {
    const segments: Segment[] = [{ kind: 'emoji', source: 'twemoji', url: 'u', raw: '👼' }]

    const lines = wrapSegments(segments, {
      maxWidth: 1000,
      measurer: fakeMeasurer(10),
      // 20 * (1 + 0.5 * 2) = 40
      metrics: fakeMetrics(20, 0.5),
    })

    expect(lines).toHaveLength(1)
  })

  describe('emoji that failed to load', () => {
    const failed: Segment[] = [
      { kind: 'text', value: 'これ ' },
      {
        kind: 'emoji',
        source: 'discord',
        url: 'https://cdn.test/nope.png',
        raw: '<:nope:123456789012345678>',
        id: '123456789012345678',
        name: 'nope',
        animated: false,
      },
      { kind: 'text', value: ' です' },
    ]

    const nothingLoaded = () => false
    const everythingLoaded = () => true

    it('wraps its fallback text within maxWidth', () => {
      // The shortcode is 26 ASCII characters — 260 units — where the square it stood in for was 20. Left as an emoji token it is unbreakable, and the line runs off the canvas; as text it wraps like anything else.
      const lines = wrapSegments(resolveEmojiSegments(failed, nothingLoaded, 'text'), {
        maxWidth: 100,
        measurer: fakeMeasurer(10),
        metrics: fakeMetrics(20, 0),
      })

      for (const width of widths(lines)) expect(width).toBeLessThanOrEqual(100)
    })

    it('keeps every character of the fallback text', () => {
      const lines = wrapSegments(resolveEmojiSegments(failed, nothingLoaded, 'text'), {
        maxWidth: 100,
        measurer: fakeMeasurer(10),
        metrics: fakeMetrics(20, 0),
      })

      expect(lines.map(lineToString).join('')).toBe('これ <:nope:123456789012345678> です')
    })

    it('takes no width at all when it is dropped', () => {
      const lines = wrapSegments(resolveEmojiSegments(failed, nothingLoaded, 'ignore'), {
        maxWidth: 1000,
        measurer: fakeMeasurer(10),
        metrics: fakeMetrics(20, 0),
      })

      // 'これ ' (50) + nothing + ' です' (50)
      expect(widths(lines)[0]).toBe(100)
    })

    it('stays a square when the image did resolve', () => {
      const lines = wrapSegments(resolveEmojiSegments(failed, everythingLoaded, 'text'), {
        maxWidth: 1000,
        measurer: fakeMeasurer(10),
        metrics: fakeMetrics(20, 0),
      })

      expect(widths(lines)[0]).toBe(120)
    })
  })

  it('merges adjacent text runs so drawing issues one call per run', () => {
    const lines = wrapSegments(segmentText('ab cd'), {
      maxWidth: 1000,
      measurer: fakeMeasurer(10),
      metrics: fakeMetrics(20, 0),
    })

    expect(lines[0]).toEqual([{ kind: 'text', value: 'ab cd' }])
  })
})

describe('wrapSegments with styled segments', () => {
  /** Bold is twice as wide as regular, so a style-blind wrap would disagree with this. */
  function styleAwareMeasurer() {
    return {
      measureText(text: string, style?: { bold?: boolean }) {
        return { width: text.length * (style?.bold ? 20 : 10) }
      },
    }
  }

  it('measures each segment in its own style rather than one shared font', () => {
    const segments: Segment[] = [
      { kind: 'text', value: 'ab', style: { bold: true } }, // 2 * 20 = 40
      { kind: 'text', value: 'cd' }, // 2 * 10 = 20
    ]

    // 40 + 20 = 60 fits; a style-blind measurer using the regular width for both (20 + 20 = 40) would also fit, so this only proves something if the bold segment is actually measured wider — assert that directly too.
    const lines = wrapSegments(segments, {
      maxWidth: 60,
      measurer: styleAwareMeasurer(),
      metrics: fakeMetrics(20, 0),
    })
    expect(lines).toEqual([segments])

    const wrapped = wrapSegments(segments, {
      maxWidth: 50,
      measurer: styleAwareMeasurer(),
      metrics: fakeMetrics(20, 0),
    })
    // Now the bold "ab" (40) alone fits under 50, but adding "cd" (20) would not (60 > 50) — so it must wrap, which only happens if bold is really measured at double width.
    expect(wrapped).toEqual([[segments[0]], [segments[1]]])
  })

  it('keeps a style boundary from being merged into one run', () => {
    const segments: Segment[] = [
      { kind: 'text', value: 'bold', style: { bold: true } },
      { kind: 'text', value: 'plain' },
    ]

    const lines = wrapSegments(segments, {
      maxWidth: 1000,
      measurer: fakeMeasurer(10),
      metrics: fakeMetrics(20, 0),
    })

    expect(lines[0]).toEqual(segments)
  })

  it('still merges adjacent runs that share the same style', () => {
    const segments: Segment[] = [
      { kind: 'text', value: 'a', style: { bold: true } },
      { kind: 'text', value: 'b', style: { bold: true } },
    ]

    const lines = wrapSegments(segments, {
      maxWidth: 1000,
      measurer: fakeMeasurer(10),
      metrics: fakeMetrics(20, 0),
    })

    expect(lines[0]).toEqual([{ kind: 'text', value: 'ab', style: { bold: true } }])
  })
})

import { describe, expect, it } from 'vitest'
import { BreakPriority, findBreakpoints } from './breakpoint'

/** Renders the priorities as a string aligned under the text, for readable assertions. */
function marks(text: string, options?: Parameters<typeof findBreakpoints>[1]): string {
  const priorities = findBreakpoints(text, options)
  return priorities
    .slice(0, text.length)
    .map((p) => (p === BreakPriority.phrase ? 'P' : p === BreakPriority.char ? 'c' : '.'))
    .join('')
}

function phrasePoints(text: string, options?: Parameters<typeof findBreakpoints>[1]): number[] {
  return findBreakpoints(text, options)
    .map((p, i) => (p === BreakPriority.phrase ? i : -1))
    .filter((i) => i >= 0)
}

describe('findBreakpoints', () => {
  it('never allows a break at the very start or end', () => {
    const priorities = findBreakpoints('hello world')

    expect(priorities[0]).toBe(BreakPriority.none)
    expect(priorities[priorities.length - 1]).toBe(BreakPriority.none)
  })

  it('handles empty text', () => {
    expect(findBreakpoints('')).toEqual([BreakPriority.none])
  })

  it('breaks after a space, not before it', () => {
    expect(marks('ab cd')).toBe('...P.')
  })

  it('treats a run of spaces as one break position', () => {
    expect(phrasePoints('ab   cd')).toEqual([5])
  })

  it('breaks after a hyphen', () => {
    expect(marks('e-mail')).toBe('..P...')
  })

  it('offers every character boundary in CJK as a fallback', () => {
    const priorities = findBreakpoints('日本語', { phraseBreak: false })

    expect(priorities[1]).toBe(BreakPriority.char)
    expect(priorities[2]).toBe(BreakPriority.char)
  })

  it('promotes BudouX phrase boundaries above character boundaries', () => {
    const withPhrases = phrasePoints('今日は天気です')

    // BudouX splits this as 今日は / 天気です.
    expect(withPhrases).toContain(3)
  })

  it('finds no phrase boundaries once phraseBreak is off', () => {
    expect(phrasePoints('今日は天気です', { phraseBreak: false })).toEqual([])
  })

  it('finds no phrase boundaries when the locale is none', () => {
    expect(phrasePoints('今日は天気です', { locale: 'none' })).toEqual([])
  })

  it('never breaks inside a surrogate pair', () => {
    const priorities = findBreakpoints('あ𩸽い')

    // The fish occupies indices 1 and 2; only its start is a legal position.
    expect(priorities[2]).toBe(BreakPriority.none)
  })

  it('never breaks inside a ZWJ emoji sequence', () => {
    const text = 'あ👨‍👩‍👧‍👦い'
    const priorities = findBreakpoints(text)

    for (let i = 2; i < text.length - 1; i++) {
      expect(priorities[i]).toBe(BreakPriority.none)
    }
  })

  describe('RTL scripts (Arabic)', () => {
    it('breaks after a space, the same as any other space-delimited script', () => {
      // "مرحبا بالعالم" — "hello world", two space-separated words. Arabic reads right to left, but findBreakpoints works on logical (storage) order, so this is exactly the space rule already covered for Latin.
      const text = 'مرحبا بالعالم'
      expect(phrasePoints(text)).toEqual([text.indexOf(' ') + 1])
    })

    it('offers no fallback break inside a single unspaced word', () => {
      // Arabic uses spaces between words, unlike CJK — so a single word with no space gets no break at all, the same as a Latin one.
      const priorities = findBreakpoints('اختبار')
      expect(priorities.every((p) => p === BreakPriority.none)).toBe(true)
    })
  })

  describe('kinsoku', () => {
    it('does not let a full stop start a line', () => {
      const priorities = findBreakpoints('です。ます')

      expect(priorities[2]).toBe(BreakPriority.none)
    })

    it('does not let a closing bracket start a line', () => {
      const priorities = findBreakpoints('言葉」を')

      expect(priorities[2]).toBe(BreakPriority.none)
    })

    it('does not let a small kana start a line', () => {
      const priorities = findBreakpoints('きゃく')

      expect(priorities[1]).toBe(BreakPriority.none)
    })

    it('does not let a long-vowel mark start a line', () => {
      const priorities = findBreakpoints('コーヒー')

      expect(priorities[1]).toBe(BreakPriority.none)
    })

    it('does not let an opening bracket end a line', () => {
      const priorities = findBreakpoints('その「言葉')

      expect(priorities[3]).toBe(BreakPriority.none)
    })
  })
})

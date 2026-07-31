import { jaModel, Parser, zhHansModel, zhHantModel } from 'budoux'
import type { PhraseLocale } from '../theme/types'
import { graphemeBoundaries } from '../util/grapheme'

/**
 * How good a break position is.
 *
 * Wrapping prefers the rightmost `phrase` that fits, falling back to `char`
 * only when there is no phrase boundary on the line.
 */
export const BreakPriority = {
  none: 0,
  char: 1,
  phrase: 2,
} as const

export type BreakPriority = (typeof BreakPriority)[keyof typeof BreakPriority]

/** Characters that may not start a line; a break before them is suppressed. */
const NO_LINE_START = new Set(
  '、。，．,.）］｝〉》」』】〕〙〗)]}｡､･ーゝゞヽヾ々!?！？:;：；・…‥'
    .split('')
    .concat([
      'ぁ',
      'ぃ',
      'ぅ',
      'ぇ',
      'ぉ',
      'っ',
      'ゃ',
      'ゅ',
      'ょ',
      'ゎ',
      'ゕ',
      'ゖ',
      'ァ',
      'ィ',
      'ゥ',
      'ェ',
      'ォ',
      'ッ',
      'ャ',
      'ュ',
      'ョ',
      'ヮ',
      'ヵ',
      'ヶ',
    ]),
)

/** Characters that may not end a line; a break after them is suppressed. */
const NO_LINE_END = new Set('（［｛〈《「『【〔〘〖([{｢“‘'.split(''))

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}　-〿＀-￯]/u

const budouxModels = {
  ja: jaModel,
  'zh-hans': zhHansModel,
  'zh-hant': zhHantModel,
} as const

const parsers = new Map<string, Parser>()

function parserFor(locale: Exclude<PhraseLocale, 'none'>): Parser {
  let parser = parsers.get(locale)
  if (!parser) {
    // `Parser` + a raw model skips BudouX's HTMLProcessor, which is dead weight here.
    parser = new Parser(budouxModels[locale])
    parsers.set(locale, parser)
  }
  return parser
}

export interface BreakpointOptions {
  /** Use BudouX phrase boundaries. Default true. */
  phraseBreak?: boolean
  locale?: PhraseLocale
}

/**
 * Scores every position in `text` for how willing we are to break there.
 *
 * Index `i` describes a break *before* `text[i]`, so index 0 and `text.length`
 * are never candidates. Positions that would split a grapheme cluster are left
 * at `none`, as are ones forbidden by kinsoku rules.
 */
export function findBreakpoints(text: string, options: BreakpointOptions = {}): BreakPriority[] {
  const priorities: BreakPriority[] = new Array(text.length + 1).fill(BreakPriority.none)
  if (text.length === 0) return priorities

  const locale = options.locale ?? 'ja'
  const legal = new Set(graphemeBoundaries(text, locale === 'none' ? 'ja' : locale))

  const mark = (index: number, priority: BreakPriority) => {
    if (index <= 0 || index >= text.length) return
    if (!legal.has(index)) return
    if ((priorities[index] ?? BreakPriority.none) >= priority) return
    priorities[index] = priority
  }

  // Latin-style word wrapping: break after a run of spaces, and after a hyphen.
  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string
    if (char === ' ' || char === '\t') {
      let end = i + 1
      while (end < text.length && (text[end] === ' ' || text[end] === '\t')) end++
      mark(end, BreakPriority.phrase)
      i = end - 1
    } else if (char === '-' || char === '/') {
      mark(i + 1, BreakPriority.phrase)
    }
  }

  // CJK has no spaces, so every character boundary is a last-resort candidate.
  for (const index of legal) {
    if (index <= 0 || index >= text.length) continue
    const before = text[index - 1] as string
    const after = text[index] as string
    if (CJK.test(before) || CJK.test(after)) mark(index, BreakPriority.char)
  }

  // BudouX promotes the boundaries that actually read well.
  if (options.phraseBreak !== false && locale !== 'none') {
    let offset = 0
    for (const chunk of parserFor(locale).parse(text)) {
      offset += chunk.length
      mark(offset, BreakPriority.phrase)
    }
  }

  applyKinsoku(text, priorities)

  return priorities
}

/**
 * Japanese line-breaking rules: some characters may not start a line, and some
 * may not end one. Both are enforced by demoting the offending position to
 * `none`, which pushes the break to the next-best candidate.
 */
function applyKinsoku(text: string, priorities: BreakPriority[]): void {
  for (let i = 1; i < text.length; i++) {
    if (priorities[i] === BreakPriority.none) continue
    if (NO_LINE_START.has(text[i] as string)) priorities[i] = BreakPriority.none
    else if (NO_LINE_END.has(text[i - 1] as string)) priorities[i] = BreakPriority.none
  }
}

export function isCJK(char: string): boolean {
  return CJK.test(char)
}

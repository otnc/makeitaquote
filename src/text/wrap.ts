import type { Segment } from '../core/types'
import { graphemeBoundaries } from '../util/grapheme'
import { BreakPriority, type BreakpointOptions, findBreakpoints } from './breakpoint'
import { type EmojiMetrics, segmentWidth, styleKey, type TextMeasurer } from './measure'

export type Line = Segment[]

export interface WrapOptions extends BreakpointOptions {
  maxWidth: number
  measurer: TextMeasurer
  metrics: EmojiMetrics
}

/**
 * A unit that is never split further, plus how willing we are to break in
 * front of it.
 */
interface Token {
  segment: Segment
  /** Advance width of this token. */
  width: number
  priority: BreakPriority
}

/**
 * Breaks segments into lines that fit `maxWidth`.
 *
 * Hard newlines always split. Within a paragraph the rightmost phrase boundary
 * that fits wins; if the line has none, a character boundary is used; and if a
 * single token is wider than the whole line on its own, it is cut at grapheme
 * boundaries so it can never overflow.
 */
export function wrapSegments(segments: readonly Segment[], options: WrapOptions): Line[] {
  const lines: Line[] = []
  for (const paragraph of splitParagraphs(segments)) {
    lines.push(...wrapParagraph(paragraph, options))
  }
  return lines.length > 0 ? lines : [[]]
}

/** Splits on `\n`, which is a break the author asked for explicitly. */
function splitParagraphs(segments: readonly Segment[]): Segment[][] {
  const paragraphs: Segment[][] = [[]]

  for (const segment of segments) {
    if (segment.kind !== 'text') {
      paragraphs[paragraphs.length - 1]?.push(segment)
      continue
    }
    const parts = segment.value.split('\n')
    parts.forEach((part, index) => {
      if (index > 0) paragraphs.push([])
      if (part.length > 0) {
        paragraphs[paragraphs.length - 1]?.push(
          segment.style
            ? { kind: 'text', value: part, style: segment.style }
            : { kind: 'text', value: part },
        )
      }
    })
  }

  return paragraphs
}

function wrapParagraph(segments: readonly Segment[], options: WrapOptions): Line[] {
  const tokens = tokenize(segments, options)
  if (tokens.length === 0) return [[]]

  const lines: Line[] = []
  let current: Token[] = []
  let width = 0

  const flush = () => {
    if (current.length > 0) lines.push(mergeTokens(current))
    current = []
    width = 0
  }

  for (const token of tokens) {
    if (current.length > 0 && width + token.width > options.maxWidth) {
      const at = lastBreakPoint(current, token)
      if (at === null) {
        // Nothing on this line may be broken before, so the line ends here.
        flush()
      } else {
        // Everything from `at` onwards moves down to the next line. When `at`
        // is the end, that is nothing and the incoming token starts it alone.
        const carried = current.splice(at)
        flush()
        current = carried
        width = carried.reduce((sum, t) => sum + t.width, 0)
      }
    }

    // A token wider than the line has to be cut, or it would overflow forever.
    if (current.length === 0 && token.width > options.maxWidth) {
      const pieces = splitOversized(token, options)
      for (const piece of pieces.slice(0, -1)) lines.push([piece.segment])
      const last = pieces[pieces.length - 1]
      if (last) {
        current = [last]
        width = last.width
      }
      continue
    }

    current.push(token)
    width += token.width
  }

  flush()
  return lines.length > 0 ? lines : [[]]
}

/**
 * Index in `current` at which to start the next line.
 *
 * Prefers the rightmost phrase boundary, then the rightmost character
 * boundary. `current.length` means the incoming token starts the next line.
 * `null` means there is nowhere legal to break.
 */
function lastBreakPoint(current: Token[], incoming: Token): number | null {
  let best: number | null = null
  let bestPriority: BreakPriority = BreakPriority.none

  if (incoming.priority > BreakPriority.none) {
    best = current.length
    bestPriority = incoming.priority
  }

  for (let i = current.length - 1; i > 0; i--) {
    const priority = current[i]?.priority ?? BreakPriority.none
    if (priority > bestPriority) {
      best = i
      bestPriority = priority
      if (priority === BreakPriority.phrase) break
    }
  }

  return best
}

/**
 * Turns segments into tokens, splitting text at every legal break position so
 * the wrapper only has to decide between them.
 */
function tokenize(segments: readonly Segment[], options: WrapOptions): Token[] {
  const tokens: Token[] = []

  for (const segment of segments) {
    if (segment.kind !== 'text') {
      // An emoji may always start a line, and a line may always end before one.
      // Its width comes from segmentWidth so that an emoji which fell back to
      // its source text is measured as that text, not as a square.
      tokens.push({
        segment,
        width: segmentWidth(segment, options.measurer, options.metrics),
        priority: BreakPriority.phrase,
      })
      continue
    }

    const priorities = findBreakpoints(segment.value, options)
    let start = 0
    let priority: BreakPriority = tokens.length === 0 ? BreakPriority.none : BreakPriority.phrase

    for (let i = 1; i <= segment.value.length; i++) {
      const here =
        i === segment.value.length ? BreakPriority.none : (priorities[i] ?? BreakPriority.none)
      if (here === BreakPriority.none && i < segment.value.length) continue

      const value = segment.value.slice(start, i)
      tokens.push({
        segment: segment.style
          ? { kind: 'text', value, style: segment.style }
          : { kind: 'text', value },
        width: options.measurer.measureText(value, segment.style).width,
        priority,
      })
      start = i
      priority = here
    }
  }

  return tokens
}

/** Cuts a token that cannot fit on any line into grapheme-sized pieces. */
function splitOversized(token: Token, options: WrapOptions): Token[] {
  if (token.segment.kind !== 'text') return [token]

  const text = token.segment.value
  const style = token.segment.style
  const boundaries = graphemeBoundaries(text, options.locale === 'none' ? 'ja' : options.locale)
  const pieces: Token[] = []

  let start = 0
  let width = 0

  for (let b = 1; b < boundaries.length; b++) {
    const end = boundaries[b] as number
    const candidate = text.slice(start, end)
    const candidateWidth = options.measurer.measureText(candidate, style).width

    if (candidateWidth > options.maxWidth && end - start > 1) {
      const cut = boundaries[b - 1] as number
      const value = text.slice(start, cut)
      pieces.push({
        segment: style ? { kind: 'text', value, style } : { kind: 'text', value },
        width: options.measurer.measureText(value, style).width,
        priority: token.priority,
      })
      start = cut
      b--
      continue
    }
    width = candidateWidth
  }

  if (start < text.length) {
    const value = text.slice(start)
    pieces.push({
      segment: style ? { kind: 'text', value, style } : { kind: 'text', value },
      width: width || options.measurer.measureText(value, style).width,
      priority: pieces.length === 0 ? token.priority : BreakPriority.char,
    })
  }

  return pieces.length > 0 ? pieces : [token]
}

/** Rejoins adjacent same-styled text tokens so drawing issues one `fillText` per run. */
function mergeTokens(tokens: readonly Token[]): Line {
  const line: Line = []

  for (const token of tokens) {
    const previous = line[line.length - 1]
    if (
      token.segment.kind === 'text' &&
      previous?.kind === 'text' &&
      styleKey(previous.style) === styleKey(token.segment.style)
    ) {
      line[line.length - 1] = token.segment.style
        ? { kind: 'text', value: previous.value + token.segment.value, style: token.segment.style }
        : { kind: 'text', value: previous.value + token.segment.value }
    } else {
      line.push(token.segment)
    }
  }

  return line
}

/** The plain text of a wrapped line, with emoji shown as their source syntax. */
export function lineToString(line: Line): string {
  return line.map((segment) => (segment.kind === 'text' ? segment.value : segment.raw)).join('')
}

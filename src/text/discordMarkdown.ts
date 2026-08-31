import { type ParsedElement, parse } from 'discomd'
import type { StyledRun, TextStyle } from '../core/types'
import { plainTextOf, pushStyledRun } from './segment'

/**
 * Parses Discord-flavoured markdown into styled runs — bold, italic,
 * underline, strikethrough and their `***bold italic***` combination
 * rendered instead of stripped.
 *
 * Built on `discomd`'s own `parse()`, a flat, non-overlapping, position-based
 * tokenizer covering the syntax Discord's Markdown 101 article documents.
 * `parse()` only decomposes one level at a time — "each token describes only
 * its outermost construct" — so `**bold _and italic_**` comes back as a
 * single `bold` token whose `.content` still reads `bold _and italic_`. This
 * re-parses a wrapper token's `.content` (`WRAPPER_ELEMENTS`) to pick up
 * markup nested inside it, same as `strip()` does; `code`/`codeBlock` are the
 * one exception, since Discord renders those verbatim.
 */
export function parseDiscordMarkdown(text: string): StyledRun[] {
  return parseInto(text, undefined)
}

/**
 * Element kinds whose `.content` can itself contain further markup — bold,
 * italic, etc. wrap readable text a reader could have kept formatting; a
 * mention or timestamp's content is just its resolved form with nothing left
 * to parse, and `code`/`codeBlock`'s is verbatim by design.
 */
const WRAPPER_ELEMENTS = new Set<ParsedElement>([
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'boldItalic',
  'spoiler',
  'link',
  'embedLink',
  'blockQuote',
  'header',
  'subtext',
  'list',
])

function parseInto(text: string, style: TextStyle | undefined): StyledRun[] {
  const out: StyledRun[] = []

  for (const token of parse(text)) {
    if (!WRAPPER_ELEMENTS.has(token.element)) {
      pushStyledRun(out, token.content, style)
      continue
    }
    const addedStyle = styleFor(token.element)
    const nested = addedStyle ? { ...style, ...addedStyle } : style
    for (const run of parseInto(token.content, nested)) pushStyledRun(out, run.value, run.style)
  }

  return out
}

function styleFor(element: ParsedElement): TextStyle | undefined {
  switch (element) {
    case 'bold':
      return { bold: true }
    case 'italic':
      return { italic: true }
    case 'underline':
      return { underline: true }
    case 'strikethrough':
      return { strikethrough: true }
    case 'boldItalic':
      return { bold: true, italic: true }
    default:
      return undefined
  }
}

/**
 * Strips Discord-flavoured markdown down to plain text.
 *
 * `setFromMessage()` does not do this by default — `message.content` is
 * quoted exactly as written, and turning `**bold**` into bold is a choice,
 * not a correction (see MIGRATING.md). Opt in with
 * `setFromMessage(message, { markdown: false })`, or call this directly on
 * any text. For plain CommonMark instead, see `stripMarkdown()`.
 *
 * A thin wrapper over `parseDiscordMarkdown()`, discarding the style it
 * tracks.
 */
export function stripDiscordMarkdown(text: string): string {
  return plainTextOf(parseDiscordMarkdown(text))
}

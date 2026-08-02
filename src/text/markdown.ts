/**
 * Strips Discord-flavoured markdown down to plain text.
 *
 * `setFromMessage()` does not do this by default — `message.content` is
 * quoted exactly as written, and turning `**bold**` into bold is a choice,
 * not a correction (see MIGRATING.md). Opt in with
 * `setFromMessage(message, { stripMarkdown: true })`, or call this directly
 * on any text.
 *
 * Handles what Discord message content actually renders: bold, italic,
 * underline, strikethrough, spoilers, inline code, code blocks, block quotes
 * and headers. A backslash escapes the character after it, same as Discord.
 * `[text](url)`-style links are left alone — Discord does not render those as
 * links in message content, so stripping them would change what the message
 * actually said.
 *
 * Markers of the same kind nest fine (`**bold _and italic_**`); the same
 * character used for two different constructs at once (`**bold *and*
 * italic**`) is not guaranteed, the same ambiguity Discord's own parser has.
 */
export function stripMarkdown(text: string): string {
  let out = protectEscapes(text)

  // Code first, so nothing inside a code span is read as other markdown.
  out = out.replace(/```(?:[^\n`]*\n)?([\s\S]*?)```/g, (_, code: string) => code.trim())
  out = out.replace(/`([^`]+)`/g, '$1')

  // A line starting with `>` (or `>>>`, which quotes the rest of the message).
  out = out.replace(/^>>>\s?([\s\S]*)$/m, '$1')
  out = out.replace(/^>\s?/gm, '')

  out = out.replace(/^#{1,3}\s+/gm, '')

  // Longest marker first, so *** isn't read as * immediately followed by **.
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1')
  out = out.replace(/__([^_]+)__/g, '$1')
  out = out.replace(/(?<![*\w])\*([^*]+)\*(?!\w)/g, '$1')
  out = out.replace(/(?<![_\w])_([^_]+)_(?!\w)/g, '$1')
  out = out.replace(/~~([^~]+)~~/g, '$1')
  out = out.replace(/\|\|([^|]+)\|\|/g, '$1')

  return restoreEscapes(out)
}

/** Characters Discord lets you escape with a backslash. */
const ESCAPABLE = '\\*_~`|>#'

/** Private-use codepoint an escaped character is parked at while protected. */
const PLACEHOLDER_BASE = 0xe000

const PLACEHOLDER_CODES = new Set(
  Array.from(ESCAPABLE, (char) => PLACEHOLDER_BASE + char.charCodeAt(0)),
)

/**
 * Swaps `\X` for a private-use codepoint carrying X, so nothing below can
 * mistake an escaped character for the markdown it usually introduces.
 */
function protectEscapes(text: string): string {
  return text.replace(/\\(.)/g, (whole, char: string) =>
    ESCAPABLE.includes(char) ? String.fromCharCode(PLACEHOLDER_BASE + char.charCodeAt(0)) : whole,
  )
}

function restoreEscapes(text: string): string {
  return Array.from(text, (char) => {
    const code = char.charCodeAt(0)
    return PLACEHOLDER_CODES.has(code) ? String.fromCharCode(code - PLACEHOLDER_BASE) : char
  }).join('')
}

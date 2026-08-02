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
  const code: string[] = []
  let out = protectEscapes(text)

  // Code first — but its *contents* have to be set aside, not just unwrapped.
  // Discord renders a code span literally, so `**x**` inside one is the text
  // `**x**`; dropping only the backticks here would leave the asterisks for
  // the passes below to strip, which is exactly what they must not do.
  out = out.replace(/```(?:[^\n`]*\n)?([\s\S]*?)```/g, (_, inner: string) =>
    stash(code, inner.trim()),
  )
  out = out.replace(/`([^`]+)`/g, (_, inner: string) => stash(code, inner))

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

  return restoreEscapes(restoreCode(out, code))
}

/**
 * Parks a code span's contents out of reach of every pass below, keyed by
 * its index.
 *
 * The sentinel is built from a private-use codepoint, so it cannot collide
 * with anything a real message contains — and carries no character any of
 * those passes look for.
 */
const CODE_SENTINEL = ''

function stash(store: string[], value: string): string {
  // Escapes were protected before this ran, so `\*` inside the span is
  // sitting here as a placeholder. Inside code a backslash is literal, not
  // an escape, so it goes back as the two characters it was written as.
  store.push(unprotectEscapes(value))
  return `${CODE_SENTINEL}${store.length - 1}${CODE_SENTINEL}`
}

function restoreCode(text: string, store: string[]): string {
  if (store.length === 0) return text
  return text.replace(
    new RegExp(`${CODE_SENTINEL}(\\d+)${CODE_SENTINEL}`, 'g'),
    (whole, index: string) => store[Number(index)] ?? whole,
  )
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

/** Puts `\X` back as it was written, for text that is literal after all. */
function unprotectEscapes(text: string): string {
  return Array.from(text, (char) => {
    const code = char.charCodeAt(0)
    return PLACEHOLDER_CODES.has(code) ? `\\${String.fromCharCode(code - PLACEHOLDER_BASE)}` : char
  }).join('')
}

function restoreEscapes(text: string): string {
  return Array.from(text, (char) => {
    const code = char.charCodeAt(0)
    return PLACEHOLDER_CODES.has(code) ? String.fromCharCode(code - PLACEHOLDER_BASE) : char
  }).join('')
}

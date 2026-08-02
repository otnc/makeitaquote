/**
 * Strips MFM — Misskey Flavoured Markup — down to plain text.
 *
 * The Misskey counterpart to `stripMarkdown()`, and needed for the same
 * reason: a note's raw text carries markup the client expands, so quoting it
 * verbatim puts `$[jelly ...]` and `<center>` in the picture.
 *
 * Handles what a note actually renders: bold, italic, strike, small, centre,
 * quotes, inline code and code blocks, maths, links, and the `$[fn …]`
 * decoration functions — including nested ones, which is why they are matched
 * by scanning brackets rather than with a regex.
 *
 * Deliberately left alone:
 *
 * - `:name:` custom emoji, which the emoji layer draws as images
 * - `@user` and `@user@host` mentions — unlike Discord, MFM writes these as
 *   the readable name already, so there is nothing to resolve
 * - `#hashtag`, for the same reason
 */
export function stripMfm(text: string): string {
  const code: string[] = []

  // Code first, and set aside rather than merely unwrapped: a code span is
  // literal, so markup inside one is text and must survive every pass below.
  let out = text.replace(/```(?:[^\n`]*\n)?([\s\S]*?)```/g, (_, inner: string) =>
    stash(code, inner.trim()),
  )
  out = out.replace(/`([^`\n]+)`/g, (_, inner: string) => stash(code, inner))

  // Maths is likewise verbatim content in a wrapper.
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner: string) => stash(code, inner.trim()))
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner: string) => stash(code, inner.trim()))

  out = stripFunctions(out)

  // `<center>` is a *block*: MFM only reads it as one when it opens a line,
  // and treats it as literal text anywhere else. Checked against the
  // reference parser (misskey-dev/mfm.js), which parses `a <center>x</center>`
  // as one text node and `<center>x</center>` on its own line as a centre.
  out = out.replace(/^<center>([\s\S]*?)<\/center>/gm, '$1')

  // The rest are inline, and unwrap wherever they appear.
  out = out.replace(/<\/?(?:b|i|s|small|plain)>/g, '')

  out = out.replace(/^>\s?/gm, '')

  // Longest marker first, so *** is not read as * then **.
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1')
  out = out.replace(/__([^_]+)__/g, '$1')
  out = out.replace(/(?<![*\w])\*([^*]+)\*(?!\w)/g, '$1')
  out = out.replace(/(?<![_\w])_([^_]+)_(?!\w)/g, '$1')
  out = out.replace(/~~([^~]+)~~/g, '$1')

  // MFM renders these as real links, so the label is what was on screen.
  // `?[…](…)` is the same thing without a preview.
  out = out.replace(/\??\[([^\]]*)\]\((?:[^)]*)\)/g, '$1')

  return restore(out, code)
}

/**
 * Unwraps every `$[fn …]`, innermost first.
 *
 * A regex cannot do this: the contents are parsed again, so functions nest
 * (`$[spin $[flip x]]`) and a lazy match would stop at the first `]`. Walking
 * the string and counting brackets is the honest way to find the real end.
 */
function stripFunctions(text: string): string {
  let out = text

  for (;;) {
    const start = out.indexOf('$[')
    if (start === -1) return out

    const end = matchingBracket(out, start + 1)
    if (end === -1) return out

    const body = out.slice(start + 2, end)
    // `$[fn content]` and `$[fn.a=1,b=2 content]` — the name and its
    // parameters run to the first space, and everything after it is content.
    const space = body.indexOf(' ')
    const content = space === -1 ? '' : body.slice(space + 1)

    out = out.slice(0, start) + content + out.slice(end + 1)
  }
}

/** Index of the `]` closing the `[` at `open`, or -1 if it never closes. */
function matchingBracket(text: string, open: number): number {
  let depth = 0

  for (let i = open; i < text.length; i++) {
    if (text[i] === '[') depth++
    else if (text[i] === ']') {
      depth--
      if (depth === 0) return i
    }
  }

  return -1
}

/** A private-use codepoint, so a note can never contain the sentinel itself. */
const SENTINEL = ''

function stash(store: string[], value: string): string {
  store.push(value)
  return `${SENTINEL}${store.length - 1}${SENTINEL}`
}

function restore(text: string, store: string[]): string {
  if (store.length === 0) return text
  return text.replace(
    new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, 'g'),
    (whole, index: string) => store[Number(index)] ?? whole,
  )
}

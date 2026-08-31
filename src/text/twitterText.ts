import type { StyledRun, TextStyle } from '../core/types'
import { pushStyledRun } from './segment'

/**
 * Parses "Twitter bold/italic" — Unicode Mathematical Alphanumeric Symbols —
 * into styled runs, decoding each character back to plain ASCII.
 *
 * X has no real rich-text markup for a tweet's body (confirmed against both
 * the official API v2 and FxTwitter: `text` is always plain). What reads as
 * bold or italic there is one of the six Latin-alphabet blocks Unicode
 * assigned in the Mathematical Alphanumeric Symbols range (U+1D400–U+1D7FF) —
 * serif and sans-serif, each in bold, italic and bold-italic — that a client
 * or third-party tool substitutes character-by-character. Two of those six
 * (the serif and sans-serif *bold* blocks) also have their own digit range;
 * italic has none in Unicode, so a styled number stays plain ASCII already.
 * `ℎ` (U+210E, PLANCK CONSTANT) is a Unicode compatibility carry-over
 * standing in for italic lowercase h, which the main block never assigned.
 *
 * Anything outside these ranges — including plain (unstyled) sans-serif and
 * monospace, which exist in the same block but were never a "bold/italic"
 * convention — passes through unstyled.
 */
export function parseTwitterText(text: string): StyledRun[] {
  const out: StyledRun[] = []
  for (const char of text) {
    const decoded = decode(char.codePointAt(0) as number)
    if (decoded) pushStyledRun(out, decoded.char, decoded.style)
    else pushStyledRun(out, char, undefined)
  }
  return out
}

interface StyledRange {
  /** First code point of the block's `A`. */
  upperStart: number
  /** First code point of the block's `a`. */
  lowerStart: number
  /** First code point of the block's `0`, when this style has a digit range. */
  digitStart?: number
  style: TextStyle
}

const RANGES: readonly StyledRange[] = [
  { upperStart: 0x1d400, lowerStart: 0x1d41a, digitStart: 0x1d7ce, style: { bold: true } },
  { upperStart: 0x1d434, lowerStart: 0x1d44e, style: { italic: true } },
  { upperStart: 0x1d468, lowerStart: 0x1d482, style: { bold: true, italic: true } },
  { upperStart: 0x1d5d4, lowerStart: 0x1d5ee, digitStart: 0x1d7ec, style: { bold: true } },
  { upperStart: 0x1d608, lowerStart: 0x1d622, style: { italic: true } },
  { upperStart: 0x1d63c, lowerStart: 0x1d656, style: { bold: true, italic: true } },
]

/** Legacy compatibility code point standing in for italic lowercase h. */
const ITALIC_H = 0x210e

function decode(codePoint: number): { char: string; style: TextStyle } | null {
  if (codePoint === ITALIC_H) return { char: 'h', style: { italic: true } }

  for (const range of RANGES) {
    if (codePoint >= range.upperStart && codePoint < range.upperStart + 26) {
      return { char: String.fromCharCode(65 + (codePoint - range.upperStart)), style: range.style }
    }
    if (codePoint >= range.lowerStart && codePoint < range.lowerStart + 26) {
      return { char: String.fromCharCode(97 + (codePoint - range.lowerStart)), style: range.style }
    }
    if (
      range.digitStart !== undefined &&
      codePoint >= range.digitStart &&
      codePoint < range.digitStart + 10
    ) {
      return { char: String.fromCharCode(48 + (codePoint - range.digitStart)), style: range.style }
    }
  }

  return null
}

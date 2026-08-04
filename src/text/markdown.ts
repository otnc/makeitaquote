import { marked, type Token, type Tokens } from 'marked'

/**
 * Strips plain CommonMark (plus the common GFM extras: strikethrough, tables,
 * task lists) down to plain text.
 *
 * For a source that isn't Discord or Misskey — a blog post, a GitHub
 * comment, a Mastodon toot — but still needs its markup gone before it goes
 * on a quote image: `.setText(stripMarkdown(text))`. For Discord's own
 * dialect use `stripDiscordMarkdown()`, and for Misskey's, `stripMfm()`;
 * both diverge from CommonMark in ways this function does not follow.
 *
 * Built on `marked`'s lexer rather than a local approximation, for the same
 * reason `stripDiscordMarkdown()` and `stripMfm()` lean on their own
 * reference parsers: CommonMark has enough corners — a fenced code block's
 * language tag, reference-style `[label][ref]` links, loose vs. tight lists —
 * that matching a real implementation is worth the dependency. What is left
 * here is only the walk from its token tree back down to text.
 *
 * A link or image keeps its label/alt text and drops the URL, same as
 * `stripMfm()` does for MFM links — that is what a reader saw, not the
 * address behind it. Raw inline/block HTML is dropped rather than rendered
 * or left as literal tag text, since neither is "plain text" either.
 */
export function stripMarkdown(text: string): string {
  // A run of 3+ newlines shows up whenever a block that renders nothing (an
  // `hr`, a raw HTML block, a link reference definition) sits between two
  // blank-line gaps — each gap is real syntax on its own, but a reader never
  // saw more than one blank line where the invisible block used to be. A
  // leading/trailing run collapses the same way, down to nothing.
  return joinTokens(marked.lexer(text))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * A CommonMark list nests one directly under its parent item, with no
 * `space` token of its own to mark the break — everywhere else, `marked`
 * already puts an explicit `space` token between adjacent blocks, so only
 * this one case needs a break inserted by hand.
 */
function joinTokens(tokens: readonly Token[]): string {
  return tokens.reduce((out, token, index) => {
    const previous = tokens[index - 1]
    const needsBreak =
      token.type === 'list' &&
      previous !== undefined &&
      previous.type !== 'space' &&
      !out.endsWith('\n')
    return out + (needsBreak ? '\n' : '') + toPlainToken(token)
  }, '')
}

function toPlainToken(token: Token): string {
  switch (token.type) {
    // The blank-line gap between two block-level siblings, carried as a
    // token in its own right — its raw text *is* the separator.
    case 'space':
      return token.raw

    // Markup, not content, in every form `marked` tokenizes it as.
    case 'html':
      return ''

    // A hard line break renders as one, same as a reader would have seen.
    case 'br':
      return '\n'

    // `- [ ] `/`- [x] ` carries real information (done or not), so it stays
    // rather than vanishing the way a bold/italic marker does.
    case 'checkbox':
      return token.raw

    // `marked`'s own `Token` type keeps an escape hatch (`Tokens.Generic`)
    // for custom tokenizer extensions in its union, which is loose enough
    // that switching on `.type` alone can't narrow it away — hence the casts
    // below. Nothing here registers an extension, so a `Generic` token never
    // actually reaches these two cases.
    case 'list':
      return (token as Tokens.List).items.map((item) => joinTokens(item.tokens)).join('\n')

    case 'table':
      return toPlainTable(token as Tokens.Table)

    // Everything else is either a leaf (`.text`, no further markup to walk —
    // a code span/block, an escaped character, a link reference definition
    // with nothing to show) or a wrapper around further tokens (bold,
    // italic, a heading, a paragraph, a link/image's label, a list item's
    // own content). A wrapper is told apart by actually having a non-empty
    // `.tokens` — an empty inline run still carries the property.
    default:
      return 'tokens' in token && token.tokens && token.tokens.length > 0
        ? joinTokens(token.tokens)
        : 'text' in token && typeof token.text === 'string'
          ? token.text
          : ''
  }
}

/** Tab-separated cells, one row per line — plain text has no columns to align. */
function toPlainTable(token: Tokens.Table): string {
  return [token.header, ...token.rows]
    .map((row) => row.map((cell) => joinTokens(cell.tokens)).join('\t'))
    .join('\n')
}

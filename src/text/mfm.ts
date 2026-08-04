import type { MfmNode } from 'mfm-js'
import * as mfm from 'mfm-js'

/**
 * Strips MFM — Misskey Flavoured Markup — down to plain text.
 *
 * The Misskey counterpart to `stripDiscordMarkdown()`, and needed for the same
 * reason: a note's raw text carries markup the client expands, so quoting it
 * verbatim puts `$[jelly …]` and `<center>` in the picture.
 *
 * Parsing goes through `mfm-js`, Misskey's own parser, rather than a local
 * approximation. MFM has enough corners — `$[fn …]` re-parses its contents so
 * functions nest, `<center>` is a block that only counts at the start of a
 * line, code and maths are verbatim — that matching the reference
 * implementation is worth the dependency. What is left here is only the walk
 * from its AST back down to text.
 *
 * Deliberately kept rather than stripped:
 *
 * - `:name:` custom emoji, which the emoji layer draws as images
 * - `@user` and `@user@host` mentions — unlike Discord, MFM writes these as
 *   the readable name already, so there is nothing to resolve
 * - `#hashtag`, and a bare URL, for the same reason
 */
export function stripMfm(text: string): string {
  return joinBlocks(mfm.parse(text))
}

/**
 * The node types MFM treats as blocks, each of which owns its own line.
 *
 * The parser consumes the newline that separates two blocks, since there it
 * is syntax rather than content. Flattening without putting it back would run
 * the lines together — `あ\n<center>ね</center>` would come out as `あね` —
 * so a break goes back wherever a block meets a neighbour. Text inside one
 * paragraph is untouched: the parser keeps those newlines itself.
 */
const BLOCKS = new Set(['quote', 'search', 'blockCode', 'mathBlock', 'center'])

function joinBlocks(nodes: readonly MfmNode[]): string {
  return nodes.reduce((out, node, index) => {
    const previous = nodes[index - 1]
    const separator =
      previous && (BLOCKS.has(previous.type) || BLOCKS.has(node.type)) && !out.endsWith('\n')
        ? '\n'
        : ''
    return out + separator + toPlainNode(node)
  }, '')
}

function toPlainNode(node: MfmNode): string {
  switch (node.type) {
    case 'text':
      return node.props.text

    // Written back as the source spelled them: an emoji shortcode has to
    // survive for the emoji layer to swap a picture in, and the rest are
    // already the readable form.
    case 'emojiCode':
      return `:${node.props.name}:`
    case 'unicodeEmoji':
      return node.props.emoji
    case 'mention':
      return node.props.acct
    case 'hashtag':
      return `#${node.props.hashtag}`
    case 'url':
      return node.props.url

    // Verbatim content in a wrapper — the wrapper goes, the content stays
    // exactly as it was written.
    case 'inlineCode':
    case 'blockCode':
      return node.props.code
    case 'mathInline':
    case 'mathBlock':
      return node.props.formula
    case 'search':
      return node.props.query

    // A link renders as its label, which is what a reader saw. The label is
    // never empty: `[](url)` is not a link to MFM at all — it parses as a
    // bare url with brackets around it, and arrives here as `url`.
    case 'link':
      return joinBlocks(node.children)

    // Everything else is decoration around children: bold, italic, strike,
    // small, centre, quote, plain, and every `$[fn …]`.
    default:
      return 'children' in node && node.children ? joinBlocks(node.children) : ''
  }
}

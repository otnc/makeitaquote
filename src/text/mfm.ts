import type { MfmNode } from 'mfm-js'
import * as mfm from 'mfm-js'
import type { StyledRun, TextStyle } from '../core/types'
import { plainTextOf, pushStyledRun } from './segment'

/**
 * Parses MFM — Misskey Flavoured Markup — into styled runs: bold, italic and strikethrough rendered instead of stripped.
 *
 * Parsing goes through `mfm-js`, Misskey's own parser, rather than a local approximation — see `stripMfm()` for why. `small`/`center` change font size or layout rather than style, so (like headings elsewhere in this package) they are left structural: their content passes through at the surrounding style, undecorated.
 *
 * Kept exactly as `stripMfm()` keeps them — `:name:` custom emoji, `@user`/`@user@host` mentions, `#hashtag` and bare URLs are all plain runs.
 */
export function parseMfm(text: string): StyledRun[] {
  return joinStyledBlocks(mfm.parse(text), undefined)
}

/**
 * Strips MFM — Misskey Flavoured Markup — down to plain text.
 *
 * The Misskey counterpart to `stripDiscordMarkdown()`, and needed for the same reason: a note's raw text carries markup the client expands, so quoting it verbatim puts `$[jelly …]` and `<center>` in the picture.
 *
 * MFM has enough corners — `$[fn …]` re-parses its contents so functions nest, `<center>` is a block that only counts at the start of a line, code and maths are verbatim — that matching the reference implementation is worth the dependency. A thin wrapper over `parseMfm()`, discarding the style it tracks.
 *
 * Deliberately kept rather than stripped:
 *
 * - `:name:` custom emoji, which the emoji layer draws as images
 * - `@user` and `@user@host` mentions — unlike Discord, MFM writes these as the readable name already, so there is nothing to resolve
 * - `#hashtag`, and a bare URL, for the same reason
 */
export function stripMfm(text: string): string {
  return plainTextOf(parseMfm(text))
}

/**
 * The node types MFM treats as blocks, each of which owns its own line.
 *
 * The parser consumes the newline that separates two blocks, since there it is syntax rather than content. Flattening without putting it back would run the lines together — `あ\n<center>ね</center>` would come out as `あね` — so a break goes back wherever a block meets a neighbour. Text inside one paragraph is untouched: the parser keeps those newlines itself.
 */
const BLOCKS = new Set(['quote', 'search', 'blockCode', 'mathBlock', 'center'])

function joinStyledBlocks(nodes: readonly MfmNode[], style: TextStyle | undefined): StyledRun[] {
  const out: StyledRun[] = []
  let previous: MfmNode | undefined

  for (const node of nodes) {
    if (previous && (BLOCKS.has(previous.type) || BLOCKS.has(node.type))) {
      pushStyledRun(out, '\n', undefined)
    }
    for (const run of toStyledNode(node, style)) pushStyledRun(out, run.value, run.style)
    previous = node
  }

  return out
}

function toStyledNode(node: MfmNode, style: TextStyle | undefined): StyledRun[] {
  switch (node.type) {
    case 'text':
      return [style ? { value: node.props.text, style } : { value: node.props.text }]

    // Written back as the source spelled them: an emoji shortcode has to survive for the emoji layer to swap a picture in, and the rest are already the readable form.
    case 'emojiCode':
      return [{ value: `:${node.props.name}:` }]
    case 'unicodeEmoji':
      return [{ value: node.props.emoji }]
    case 'mention':
      return [{ value: node.props.acct }]
    case 'hashtag':
      return [{ value: `#${node.props.hashtag}` }]
    case 'url':
      return [{ value: node.props.url }]

    // Verbatim content in a wrapper — the wrapper goes, the content stays exactly as it was written.
    case 'inlineCode':
    case 'blockCode':
      return [{ value: node.props.code }]
    case 'mathInline':
    case 'mathBlock':
      return [{ value: node.props.formula }]
    case 'search':
      return [{ value: node.props.query }]

    // A link renders as its label, which is what a reader saw. The label is never empty: `[](url)` is not a link to MFM at all — it parses as a bare url with brackets around it, and arrives here as `url`.
    case 'link':
      return joinStyledBlocks(node.children, style)

    case 'bold':
      return joinStyledBlocks(node.children, { ...style, bold: true })
    case 'italic':
      return joinStyledBlocks(node.children, { ...style, italic: true })
    case 'strike':
      return joinStyledBlocks(node.children, { ...style, strikethrough: true })

    // `small`/`center` change size or layout, not style (deferred — see the module doc comment); `plain`, `quote` and every `$[fn …]` are otherwise undecorated wrappers.
    default:
      return 'children' in node && node.children ? joinStyledBlocks(node.children, style) : []
  }
}

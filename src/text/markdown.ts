import MarkdownIt from 'markdown-it'

const parser = new MarkdownIt('commonmark', { html: true }).enable(['strikethrough', 'table'])

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
 * Built on `markdown-it`'s parser rather than a local approximation, for the
 * same reason `stripDiscordMarkdown()` and `stripMfm()` lean on their own
 * reference parsers: CommonMark has enough corners — a fenced code block's
 * language tag, reference-style `[label][ref]` links, loose vs. tight lists —
 * that matching a real implementation is worth the dependency. What is left
 * here is only the walk from its token stream back down to text.
 *
 * A link or image keeps its label/alt text and drops the URL, same as
 * `stripMfm()` does for MFM links — that is what a reader saw, not the
 * address behind it. Raw inline/block HTML is dropped rather than rendered
 * or left as literal tag text, since neither is "plain text" either. A task
 * list item (`- [ ] `/`- [x] `) keeps its marker, since checked-or-not is
 * real information rather than decoration.
 */
export function stripMarkdown(text: string): string {
  // A run of 3+ newlines can still show up around a block that renders
  // nothing (an `hr`, a raw HTML block) sitting between two blank-line gaps —
  // each gap real syntax on its own, but a reader never saw more than one
  // blank line where the invisible block used to be. A leading/trailing run
  // collapses the same way, down to nothing.
  return joinBlocks(toTree(parser.parse(text, {})))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * A flattened, minimal reshaping of `markdown-it`'s token stream.
 *
 * `markdown-it` hands back a flat array where a container (a paragraph, a
 * list item, a blockquote, …) is an `_open` token, a matching `_close`
 * later on, and everything between the two is its content — closer to SAX
 * events than a tree. Rebuilding that nesting once up front, the same shape
 * `stripDiscordMarkdown()` and `stripMfm()` already walk, means the rest of
 * this file only has to reason about parents and children.
 */
interface Node {
  type: string
  content: string
  map: readonly [number, number] | null
  children: Node[]
}

/**
 * The slice of `markdown-it`'s `Token` this file actually reads. Structural,
 * not imported: `Token` itself lives on the `MarkdownIt` namespace that
 * `export =` merges into the constructor, which `esModuleInterop`'s default
 * import doesn't carry static access to.
 */
interface RawToken {
  type: string
  content: string
  map: readonly [number, number] | null
  nesting: -1 | 0 | 1
  children: RawToken[] | null
}

function toTree(tokens: readonly RawToken[]): Node[] {
  const root: Node[] = []
  const stack: Node[][] = [root]

  for (const token of tokens) {
    const node: Node = {
      type: token.type,
      content: token.content,
      map: token.map,
      children: token.children ? toTree(token.children) : [],
    }
    const current = stack[stack.length - 1]
    if (!current) continue

    if (token.nesting === 1) {
      current.push(node)
      stack.push(node.children)
    } else if (token.nesting === -1) {
      stack.pop()
    } else {
      current.push(node)
    }
  }

  return root
}

/** `_open`/`_close` stripped off, so a container's type compares the same regardless of which one a token is. */
function kindOf(node: Node): string {
  return node.type.replace(/_(?:open|close)$/, '')
}

/**
 * Block-level container/leaf types — the ones a blank line in the source
 * can sit between. Nothing else (`text`, `strong`, a link's own children, …)
 * ever gets a separator inserted around it, so inline content still just
 * flows together.
 */
const BLOCKS = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'bullet_list',
  'ordered_list',
  'table',
  'fence',
  'code_block',
  'hr',
  'html_block',
])

function joinBlocks(nodes: readonly Node[]): string {
  return nodes.reduce((out, node, index) => {
    const previous = nodes[index - 1]
    const separator = separatorBefore(previous, node, out)
    return out + separator + toPlainNode(node)
  }, '')
}

/**
 * `markdown-it` keeps each block's source line range on its token (`.map`),
 * which is enough to tell a real blank line in the source from two blocks
 * that just happen to sit next to each other — a nested list under its
 * parent item, for instance, which CommonMark itself allows with no blank
 * line at all.
 */
function separatorBefore(previous: Node | undefined, node: Node, out: string): string {
  if (!previous || out.endsWith('\n')) return ''
  if (!BLOCKS.has(kindOf(previous)) || !BLOCKS.has(kindOf(node))) return ''

  const gap = node.map && previous.map ? node.map[0] - previous.map[1] : 0
  return gap > 0 ? '\n\n' : '\n'
}

function toPlainNode(node: Node): string {
  switch (kindOf(node)) {
    // Leaves: nothing further to walk, the content is already what a reader saw.
    case 'text':
    case 'code_inline':
    case 'image':
      return node.content

    // A line break a reader actually saw, whether CommonMark calls it soft
    // (one newline in the source) or hard (two trailing spaces).
    case 'softbreak':
    case 'hardbreak':
      return '\n'

    // Markup, not content, in every form `markdown-it` tokenizes it as.
    case 'html_inline':
    case 'html_block':
    case 'hr':
      return ''

    // The closing fence's own newline is part of the fence, not the code.
    case 'fence':
    case 'code_block':
      return node.content.replace(/\n$/, '')

    case 'bullet_list':
    case 'ordered_list':
      return node.children.map((item) => joinBlocks(item.children)).join('\n')

    case 'table':
      return toPlainTable(node)

    // Everything else is a wrapper around further tokens: bold, italic,
    // strikethrough, a heading, a paragraph, a link/image's label, a list
    // item's own content, a block quote.
    default:
      return joinBlocks(node.children)
  }
}

/** Tab-separated cells, one row per line — plain text has no columns to align. */
function toPlainTable(node: Node): string {
  const rows = node.children.flatMap((section) => section.children)
  return rows
    .map((row) => row.children.map((cell) => joinBlocks(cell.children)).join('\t'))
    .join('\n')
}

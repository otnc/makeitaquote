import MarkdownIt from 'markdown-it'
import type { StyledRun, TextStyle } from '../core/types'
import { plainTextOf, pushStyledRun } from './segment'

const parser = new MarkdownIt('commonmark', { html: true }).enable(['strikethrough', 'table'])

/**
 * Parses CommonMark (plus the common GFM extras: strikethrough, tables, task
 * lists) into styled runs — bold, italic and strikethrough rendered instead
 * of stripped, plus the `<u>`, `<b>`/`<strong>`, `<i>`/`<em>`, `<s>`/`<del>`
 * raw HTML tags CommonMark itself has no native syntax for (`<u>` has no
 * markdown syntax at all — that is what makes it worth special-casing here
 * rather than leaving it as inert raw HTML).
 *
 * Headings, lists and tables stay structural plain text (see `stripMarkdown()`'s
 * `joinBlocks`/block-separator logic, unchanged) — a heading changes size, not
 * style, and that is deferred, same as it is for MFM's `small`/`center`.
 */
export function parseMarkdown(text: string): StyledRun[] {
  const tree = pairHtmlTags(toTree(parser.parse(text, {})))
  return collapseAndTrim(joinStyledBlocks(tree, undefined))
}

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
 * that matching a real implementation is worth the dependency. A thin wrapper
 * over `parseMarkdown()`, discarding the style it tracks.
 *
 * A link or image keeps its label/alt text and drops the URL, same as
 * `stripMfm()` does for MFM links — that is what a reader saw, not the
 * address behind it. Raw inline/block HTML that isn't one of the recognized
 * style tags is dropped rather than rendered or left as literal tag text,
 * since neither is "plain text" either. A task list item (`- [ ] `/`- [x] `)
 * keeps its marker, since checked-or-not is real information rather than
 * decoration.
 */
export function stripMarkdown(text: string): string {
  return plainTextOf(parseMarkdown(text))
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
 * Raw HTML tags recognized as decoration in `true`/standard markdown mode,
 * mapped to the same kind names `strong_open`/`em_open`/`s_open` already use
 * (`'u'` is new — underline has no native CommonMark construct to share a
 * name with).
 */
const STYLE_HTML_TAGS: Record<string, string> = {
  u: 'u',
  b: 'strong',
  strong: 'strong',
  i: 'em',
  em: 'em',
  s: 's',
  del: 's',
}

/** Matches one already-isolated `html_inline` token's content: `<tag …>` or `</tag>`. */
const HTML_TAG = /^<(\/?)\s*([a-zA-Z][\w-]*)\b[^>]*>$/

interface OpenTag {
  tagName: string
  kind: string
}

/** Whether a node is a recognized style tag's opening form, e.g. `<u>` or `<b class="x">`. */
function openTagOf(node: Node): OpenTag | null {
  if (node.type !== 'html_inline') return null
  const match = HTML_TAG.exec(node.content)
  if (!match || match[1]) return null
  const tagName = (match[2] as string).toLowerCase()
  const kind = STYLE_HTML_TAGS[tagName]
  return kind ? { tagName, kind } : null
}

/** Whether a node is `</tagName>`, case-insensitively. */
function isCloseTagOf(node: Node, tagName: string): boolean {
  if (node.type !== 'html_inline') return false
  const match = HTML_TAG.exec(node.content)
  return Boolean(match?.[1] && (match[2] as string).toLowerCase() === tagName)
}

/**
 * Index of the close tag matching the open tag at `from - 1`, or `null` if
 * none follows. Tracks nesting depth for the *same* tag name reopening
 * (`<u>a<u>b</u>c</u>`) — an unrelated tag in between (`<u>a<i>b</i>c</u>`)
 * is simply skipped over, since only `tagName`'s own opens/closes affect it.
 */
function matchingCloseIndex(nodes: readonly Node[], from: number, tagName: string): number | null {
  let depth = 0
  for (let i = from; i < nodes.length; i++) {
    const node = nodes[i]
    if (!node) continue
    if (openTagOf(node)?.tagName === tagName) {
      depth++
      continue
    }
    if (isCloseTagOf(node, tagName)) {
      if (depth === 0) return i
      depth--
    }
  }
  return null
}

/**
 * Recognizes `<u>`/`<b>`/`<strong>`/`<i>`/`<em>`/`<s>`/`<del>` pairs among a
 * level's otherwise-flat `html_inline` siblings, replacing each matched pair
 * with a synthetic container node the walker treats exactly like a real
 * `strong`/`em`/`s` node.
 *
 * `markdown-it` never nests raw HTML into a tree the way it does its own
 * `**bold**`/`*em*` syntax — `<u>`, text, `</u>` all arrive as flat sibling
 * `html_inline`/`text` tokens at whatever level they were written at. This
 * runs once, recursively (post-order — a node's own children are paired
 * first, then its siblings at this level, then a matched pair's newly-sliced
 * children are paired again since they were never scanned as a sibling group
 * before). An open tag with no matching close is left as plain `html_inline`
 * and falls through to `toStyledNode`'s existing "drop it" handling.
 */
function pairHtmlTags(nodes: readonly Node[]): Node[] {
  const children = nodes.map((node) => ({ ...node, children: pairHtmlTags(node.children) }))

  const out: Node[] = []
  for (let i = 0; i < children.length; i++) {
    const node = children[i]
    if (!node) continue

    const open = openTagOf(node)
    if (!open) {
      out.push(node)
      continue
    }

    const closeIndex = matchingCloseIndex(children, i + 1, open.tagName)
    if (closeIndex === null) {
      out.push(node)
      continue
    }

    out.push({
      type: open.kind,
      content: '',
      map: null,
      children: pairHtmlTags(children.slice(i + 1, closeIndex)),
    })
    i = closeIndex
  }

  return out
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

function joinStyledBlocks(nodes: readonly Node[], style: TextStyle | undefined): StyledRun[] {
  const out: StyledRun[] = []

  nodes.forEach((node, index) => {
    const previous = nodes[index - 1]
    const separator = separatorBefore(previous, node, out)
    if (separator) pushStyledRun(out, separator, undefined)
    for (const run of toStyledNode(node, style)) pushStyledRun(out, run.value, run.style)
  })

  return out
}

/**
 * `markdown-it` keeps each block's source line range on its token (`.map`),
 * which is enough to tell a real blank line in the source from two blocks
 * that just happen to sit next to each other — a nested list under its
 * parent item, for instance, which CommonMark itself allows with no blank
 * line at all.
 */
function separatorBefore(
  previous: Node | undefined,
  node: Node,
  out: readonly StyledRun[],
): string {
  const last = out[out.length - 1]
  if (!previous || last?.value.endsWith('\n')) return ''
  if (!BLOCKS.has(kindOf(previous)) || !BLOCKS.has(kindOf(node))) return ''

  const gap = node.map && previous.map ? node.map[0] - previous.map[1] : 0
  return gap > 0 ? '\n\n' : '\n'
}

function toStyledNode(node: Node, style: TextStyle | undefined): StyledRun[] {
  switch (kindOf(node)) {
    // Leaves: nothing further to walk, the content is already what a reader saw.
    case 'text':
    case 'code_inline':
      return [style ? { value: node.content, style } : { value: node.content }]

    // A line break a reader actually saw, whether CommonMark calls it soft
    // (one newline in the source) or hard (two trailing spaces).
    case 'softbreak':
    case 'hardbreak':
      return [{ value: '\n' }]

    // Markup, not content, in every form `markdown-it` tokenizes it as. An
    // `html_inline` here is one `pairHtmlTags()` did not recognize/pair.
    case 'html_inline':
    case 'html_block':
    case 'hr':
      return []

    // The closing fence's own newline is part of the fence, not the code.
    case 'fence':
    case 'code_block':
      return [{ value: node.content.replace(/\n$/, '') }]

    case 'bullet_list':
    case 'ordered_list':
      return node.children.flatMap((item, index) => {
        const run = joinStyledBlocks(item.children, style)
        return index === 0 ? run : [{ value: '\n' } as StyledRun, ...run]
      })

    case 'table':
      return toStyledTable(node, style)

    // The four decoration kinds: CommonMark's own `**strong**`/`*em*`/
    // `~~s~~`, plus `pairHtmlTags()`'s synthetic nodes for `<u>`/`<b>`/
    // `<strong>`/`<i>`/`<em>`/`<s>`/`<del>`.
    case 'strong':
      return joinStyledBlocks(node.children, { ...style, bold: true })
    case 'em':
      return joinStyledBlocks(node.children, { ...style, italic: true })
    case 's':
      return joinStyledBlocks(node.children, { ...style, strikethrough: true })
    case 'u':
      return joinStyledBlocks(node.children, { ...style, underline: true })

    // Everything else is a wrapper around further tokens: a heading, a
    // paragraph, a link/image's label, a list item's own content, a block
    // quote — structural, not styled (headings changing size is deferred).
    default:
      return joinStyledBlocks(node.children, style)
  }
}

/** Tab-separated cells, one row per line — plain text has no columns to align. */
function toStyledTable(node: Node, style: TextStyle | undefined): StyledRun[] {
  const rows = node.children.flatMap((section) => section.children)
  return rows.flatMap((row, rowIndex) => {
    const cells = row.children.flatMap((cell, cellIndex) => {
      const run = joinStyledBlocks(cell.children, style)
      return cellIndex === 0 ? run : [{ value: '\t' } as StyledRun, ...run]
    })
    return rowIndex === 0 ? cells : [{ value: '\n' } as StyledRun, ...cells]
  })
}

/**
 * A run of 3+ newlines can still show up around a block that renders
 * nothing (an `hr`, a raw HTML block) sitting between two blank-line gaps —
 * each gap real syntax on its own, but a reader never saw more than one
 * blank line where the invisible block used to be. A leading/trailing run
 * collapses the same way, down to nothing.
 *
 * Safe to do per-run rather than on one joined string: a separator is always
 * pushed with `style: undefined`, so a run of 3+ newlines is never split
 * across a styled/unstyled boundary — it is always contained in a single run
 * (merged there by `pushStyledRun()`), same as the plain-text case this
 * mirrors.
 */
function collapseAndTrim(runs: readonly StyledRun[]): StyledRun[] {
  const collapsed = runs
    .map((run) => ({ ...run, value: run.value.replace(/\n{3,}/g, '\n\n') }))
    .filter((run) => run.value.length > 0)

  if (collapsed.length === 0) return []

  const first = collapsed[0] as StyledRun
  collapsed[0] = { ...first, value: first.value.replace(/^\s+/, '') }
  while (collapsed.length > 0 && collapsed[0]?.value === '') collapsed.shift()
  if (collapsed.length === 0) return []

  const lastIndex = collapsed.length - 1
  const last = collapsed[lastIndex] as StyledRun
  collapsed[lastIndex] = { ...last, value: last.value.replace(/\s+$/, '') }
  while (collapsed.length > 0 && collapsed[collapsed.length - 1]?.value === '') collapsed.pop()

  return collapsed
}

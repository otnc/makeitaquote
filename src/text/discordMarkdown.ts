import { strip } from 'discomd'

/**
 * Strips Discord-flavoured markdown down to plain text.
 *
 * `setFromMessage()` does not do this by default — `message.content` is
 * quoted exactly as written, and turning `**bold**` into bold is a choice,
 * not a correction (see MIGRATING.md). Opt in with
 * `setFromMessage(message, { stripDiscordMarkdown: true })`, or call this
 * directly on any text. For plain CommonMark instead, see `stripMarkdown()`.
 *
 * Built on `discomd`, which covers the syntax Discord's own Markdown 101
 * article documents: bold, italic, underline, strikethrough, spoilers,
 * inline code, code blocks, block quotes, headers, subtext and list markers.
 *
 * `[text](url)`-style masked links are the one thing left disabled: they
 * only render as clickable links in embeds, webhooks and messages a bot
 * sent — not in a message a person typed themselves, which is what this
 * function exists to render. Stripping the brackets there would show
 * something the reader's screen never did.
 */
export function stripDiscordMarkdown(text: string): string {
  return strip(text, { disable: ['link'] })
}

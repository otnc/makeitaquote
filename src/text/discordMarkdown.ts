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
 * inline code, code blocks, block quotes, headers, subtext, list markers
 * and masked links — `[text](url)` reduces to `text`, the URL dropped.
 */
export function stripDiscordMarkdown(text: string): string {
  return strip(text)
}

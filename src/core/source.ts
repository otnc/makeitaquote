import {
  avatarURL,
  formatUsername,
  globalName,
  guildName,
  resolveMentions,
} from '@makeitaquote/utils/discord'
import { stripDiscordMarkdown } from '../text/discordMarkdown'
import { ValidationError } from './errors'
import { emptyQuote, resolveMarkdownMode, resolveQuoteText, translateLegacyStrip } from './quote'
import type { MarkdownMode, MessageLike, MessageSourceOptions, QuoteData } from './types'

function isMessageLike(value: unknown): value is MessageLike {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Partial<MessageLike>
  if (typeof candidate.content !== 'string') return false
  if (candidate.author === null || typeof candidate.author !== 'object') return false
  return typeof candidate.author.username === 'string'
}

/**
 * Derives a quote from anything shaped like a Discord message.
 *
 * By default the server's view wins for both the avatar and the name — a
 * per-server avatar and nickname are what someone reading that server saw, so
 * they are what a quote from it should show. Both can be switched to the
 * account-wide version.
 *
 * Whichever is chosen, the other is still the fallback: asking for a guild
 * avatar on a message with none gets the global one rather than nothing.
 */
export function fromMessage(
  message: unknown,
  options: MessageSourceOptions = {},
  globalMarkdown?: MarkdownMode,
): QuoteData {
  if (!isMessageLike(message)) {
    throw new ValidationError(
      'setFromMessage expects a message with `content` and `author.username`',
      { field: 'message' },
    )
  }

  const preferGlobalAvatar = options.avatar === 'global'
  const preferGlobalName = options.name === 'global'

  const guildAvatar = message.member ? avatarURL(message.member) : null
  const userAvatar = avatarURL(message.author)

  const quote = emptyQuote()
  const withMentions =
    options.resolveMentions === false
      ? message.content
      : resolveMentions(
          message.content,
          message,
          typeof options.resolveMentions === 'object' ? options.resolveMentions : {},
        )
  const mode = resolveMarkdownMode(
    [options.markdown, translateLegacyStrip(options.stripDiscordMarkdown), globalMarkdown],
    'raw',
  )
  const resolvedText = resolveQuoteText(withMentions, mode, () =>
    stripDiscordMarkdown(withMentions),
  )
  quote.text = resolvedText.text
  quote.markdown = resolvedText.markdown
  quote.username = formatUsername(message.author)
  quote.displayName = preferGlobalName
    ? (globalName(message) ?? guildName(message) ?? message.author.username)
    : (guildName(message) ?? globalName(message) ?? message.author.username)
  quote.avatar = preferGlobalAvatar ? (userAvatar ?? guildAvatar) : (guildAvatar ?? userAvatar)

  return quote
}

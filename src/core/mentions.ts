import type { MessageLike } from './types'

/**
 * Turns `<@id>`, `<@!id>`, `<#id>` and `<@&id>` into `@name`/`#name`.
 *
 * `message.content` carries these as raw IDs; discord.js resolves them into
 * `message.mentions` separately, keyed by the same IDs. `@everyone`/`@here`
 * need nothing — Discord writes those as the literal text already, not a
 * token — so there is nothing for this to do with them.
 *
 * A token whose target isn't in `message.mentions` (someone who has since
 * left, a Collection the caller didn't populate) is left exactly as written,
 * the same "don't invent what isn't there" rule the emoji layer follows.
 */
export function resolveMentions(content: string, message: MessageLike): string {
  const mentions = message.mentions
  if (!mentions) return content

  return content
    .replace(/<@!?(\d+)>/g, (whole, id: string) => {
      const name =
        mentions.members?.get(id)?.nickname ||
        mentions.members?.get(id)?.displayName ||
        mentions.users?.get(id)?.username
      return name ? `@${name}` : whole
    })
    .replace(/<#(\d+)>/g, (whole, id: string) => {
      const name = mentions.channels?.get(id)?.name
      return name ? `#${name}` : whole
    })
    .replace(/<@&(\d+)>/g, (whole, id: string) => {
      const name = mentions.roles?.get(id)?.name
      return name ? `@${name}` : whole
    })
}

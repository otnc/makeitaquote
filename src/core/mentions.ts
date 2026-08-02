import type { MentionOptions, MessageLike } from './types'

/**
 * Turns Discord's raw tokens into the text a reader actually saw.
 *
 * `message.content` carries mentions as IDs (`<@1234…>`), and several other
 * things as markup only the client expands. This resolves every form Discord
 * documents:
 *
 * | Written as | Becomes |
 * | --- | --- |
 * | `<@id>`, `<@!id>` | `@nickname` |
 * | `<@&id>` | `@role` |
 * | `<#id>` | `#channel` |
 * | `</name:id>`, `</name sub:id>` | `/name sub` |
 * | `<t:seconds>`, `<t:seconds:style>` | a formatted date |
 * | `<id:browse>` and friends | the tab's name |
 *
 * `@everyone`/`@here` need nothing — Discord writes those as literal text
 * already, not a token.
 *
 * User, role and channel names come from `message.mentions`, which discord.js
 * fills in. A token whose target isn't there (someone who has since left, a
 * Collection the caller didn't populate) is left exactly as written — the
 * same "don't invent what isn't there" rule the emoji layer follows.
 * Timestamps, slash commands and navigation tabs carry everything they need
 * in the token itself, so they resolve even with no `mentions` at all.
 */
export function resolveMentions(
  content: string,
  message: MessageLike,
  options: MentionOptions = {},
): string {
  const mentions = message.mentions

  return (
    content
      // Users. `<@&…>` is a role and never matches here — `&` is neither `!`
      // nor a digit — so the two cannot be confused whatever the order.
      .replace(/<@!?(\d+)>/g, (whole, id: string) => {
        const name =
          mentions?.members?.get(id)?.nickname ||
          mentions?.members?.get(id)?.displayName ||
          mentions?.users?.get(id)?.username
        return name ? `@${name}` : whole
      })
      .replace(/<@&(\d+)>/g, (whole, id: string) => {
        const name = mentions?.roles?.get(id)?.name
        return name ? `@${name}` : whole
      })
      .replace(/<#(\d+)>/g, (whole, id: string) => {
        const name = mentions?.channels?.get(id)?.name
        return name ? `#${name}` : whole
      })
      // A slash command carries its own name, so the id is dropped rather
      // than looked up. Sub-commands are spaces within that name.
      .replace(/<\/([\w-]+(?: [\w-]+){0,2}):\d+>/g, (_, name: string) => `/${name}`)
      .replace(/<id:([a-z-]+)>/g, (whole, tab: string) => GUILD_NAVIGATION[tab] ?? whole)
      .replace(/<t:(-?\d+)(?::([tTdDfFsR]))?>/g, (whole, seconds: string, style?: string) => {
        return formatTimestamp(Number(seconds), style, options) ?? whole
      })
  )
}

/** The tabs `<id:…>` can point at, as Discord labels them. */
const GUILD_NAVIGATION: Record<string, string> = {
  browse: 'Browse Channels',
  customize: 'Channels & Roles',
  guide: 'Server Guide',
  'linked-roles': 'Linked Roles',
}

/**
 * `<t:…>` styles as `Intl.DateTimeFormat` options.
 *
 * `R` is absent on purpose — it is relative, and handled separately.
 */
const TIMESTAMP_STYLES: Record<string, Intl.DateTimeFormatOptions> = {
  t: { timeStyle: 'short' },
  T: { timeStyle: 'medium' },
  d: { dateStyle: 'short' },
  D: { dateStyle: 'long' },
  f: { dateStyle: 'long', timeStyle: 'short' },
  F: { dateStyle: 'full', timeStyle: 'short' },
  s: { dateStyle: 'short', timeStyle: 'short' },
}

/** Largest unit first, so a gap is described by the coarsest that fits. */
const RELATIVE_UNITS: Array<[unit: Intl.RelativeTimeFormatUnit, seconds: number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]

/**
 * Renders one `<t:…>`, or `null` to leave it exactly as written.
 *
 * A quote is a picture of what someone saw, so `R` stays relative — that is
 * what the screen said. Every other style is absolute, and rendered in UTC
 * unless a zone is given: a server has no business guessing the reader's.
 */
function formatTimestamp(
  seconds: number,
  style: string | undefined,
  options: MentionOptions,
): string | null {
  if (!Number.isFinite(seconds)) return null

  const date = new Date(seconds * 1000)
  if (Number.isNaN(date.getTime())) return null

  const locale = options.locale ?? 'en-GB'

  if (style === 'R') {
    const elapsed = seconds - (options.now?.getTime() ?? Date.now()) / 1000
    const [unit, size] = RELATIVE_UNITS.find(([, s]) => Math.abs(elapsed) >= s) ?? ['second', 1]
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      Math.round(elapsed / size),
      unit,
    )
  }

  // Discord's default, when no style is given, is the same as `f`.
  return new Intl.DateTimeFormat(locale, {
    ...(TIMESTAMP_STYLES[style ?? 'f'] ?? TIMESTAMP_STYLES.f),
    timeZone: options.timeZone ?? 'UTC',
  }).format(date)
}

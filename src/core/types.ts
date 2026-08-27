import type { LayoutMode, Theme, ThemeInput, ThemePalette } from '../theme/types'

export type { LayoutMode, Theme, ThemeInput, ThemePalette }

/** Anything that can stand in for an avatar image. */
export type AvatarSource = string | URL | Buffer | Uint8Array

/**
 * The normalized quote, after validation.
 *
 * Shared between the local renderer and the `makeitaquote/api` client so a
 * quote built with one can be handed to the other.
 */
export interface QuoteData {
  text: string
  avatar: AvatarSource | null
  username: string
  displayName: string
  watermark: string
}

/** A partial quote, as accepted by `setFromObject()`. */
export interface QuoteInput {
  text?: string
  avatar?: AvatarSource | null
  username?: string
  displayName?: string
  watermark?: string
  /**
   * Keeps the avatar in color instead of desaturating it.
   *
   * On the local renderer this is a shortcut for
   * `setTheme({ avatar: { grayscale: false } })`; the API client sends it
   * verbatim.
   */
  color?: boolean
}

/**
 * The shape of a Discord message that `setFromMessage()` understands.
 *
 * Structural on purpose: discord.js v13, v14 and discord.js-selfbot-v13 all
 * satisfy it, so this package needs no dependency on any of them.
 */
export interface MessageLike {
  content: string
  author: {
    username: string
    globalName?: string | null
    global_name?: string | null
    discriminator?: string | null
    // Method shorthand, not `displayAvatarURL?: (options?: unknown) => string`.
    // TS checks a property's function type contravariantly under strict mode,
    // so a real `(options?: ImageURLOptions) => string` from discord.js would
    // not satisfy a `(options?: unknown) => string` property — only a
    // shorthand method gets the bivariant check that accepts it.
    displayAvatarURL?(options?: unknown): string
  }
  member?: {
    displayName?: string
    nickname?: string | null
    displayAvatarURL?(options?: unknown): string
  } | null
  /**
   * discord.js's per-message mention Collections. Optional, and each
   * Collection independently so — a `Message` always has all four in
   * practice, but nothing here requires it.
   */
  mentions?: {
    /**
     * Backing `<@!?id>`. Guild nickname wins over the account username.
     * `null`, not just absent, in a DM — discord.js has no guild to resolve
     * a member against there.
     */
    members?: {
      get(id: string): { displayName?: string; nickname?: string | null } | undefined
    } | null
    users?: { get(id: string): { username?: string } | undefined }
    /**
     * Backing `<#id>`. `id` is here only so a DM channel — which carries no
     * `name` at all, not even `null` — still structurally overlaps this type;
     * only `name` is actually read.
     */
    channels?: { get(id: string): { id?: string; name?: string | null } | undefined }
    /** Backing `<@&id>`. */
    roles?: { get(id: string): { name?: string } | undefined }
  }
}

/**
 * How `<t:…>` timestamps are rendered when mentions are resolved.
 *
 * A timestamp is the one token whose text depends on who is looking: Discord
 * renders it in the reader's own locale and zone. An image has no reader to
 * ask, so it renders in UTC and `en-GB` unless told otherwise.
 */
export interface MentionOptions {
  /** BCP 47 tag, e.g. `'ja-JP'`. Default `'en-GB'`. */
  locale?: string
  /** IANA zone, e.g. `'Asia/Tokyo'`. Default `'UTC'`. */
  timeZone?: string
  /** What `<t:…:R>` counts from. Defaults to now; mostly a test seam. */
  now?: Date
}

/**
 * Which version of a Discord user's avatar and name to quote.
 *
 * Both default to the server's, since that is what a reader of that server
 * actually saw. Whichever you pick, the other is the fallback.
 */
export interface MessageSourceOptions {
  /** `'guild'` (default) prefers a per-server avatar; `'global'` the account's. */
  avatar?: 'guild' | 'global'
  /** `'nickname'` (default) prefers a per-server nickname; `'global'` the account's. */
  name?: 'nickname' | 'global'
  /**
   * Runs `message.content` through `stripDiscordMarkdown()` before quoting
   * it. Default false — the content is quoted exactly as written unless you
   * opt in.
   */
  stripDiscordMarkdown?: boolean
  /**
   * Expands Discord's raw tokens into the text a reader saw: user, role and
   * channel mentions, slash commands, `<t:…>` timestamps and guild
   * navigation tabs. Default true.
   *
   * Names come from `message.mentions`, so a mention whose target isn't
   * there (someone who has since left) is left exactly as written; the rest
   * carry what they need in the token and resolve regardless. Pass an object
   * to control how timestamps are rendered.
   */
  resolveMentions?: boolean | MentionOptions
}

/**
 * The shape of a Misskey note that `setFromNote()` understands.
 *
 * Structural, like `MessageLike`: this is what the API actually returns for
 * a note, so a response passed straight through fits without adaptation.
 */
export interface NoteLike {
  text?: string | null
  /** Content warning. Only read when `setFromNote` is told to prefer it. */
  cw?: string | null
  user: {
    username: string
    /** Display name. Null when the account never set one. */
    name?: string | null
    /** Instance the author is on. Null or absent when they are local. */
    host?: string | null
    avatarUrl?: string | null
  }
}

export interface NoteSourceOptions {
  /**
   * Runs the note through `stripMfm()` before quoting it. Default **true**,
   * unlike `stripDiscordMarkdown` for Discord.
   *
   * The two differ because the markup does. `**bold**` still reads as its
   * own text with the asterisks left in; `$[jelly ぷりん]` does not — the
   * function name and brackets are scaffolding that was never meant to be
   * read, so leaving them in a picture is just noise.
   */
  stripMfm?: boolean
  /**
   * Quote the content warning instead of the text it hides. Default false.
   *
   * A CW is what a reader saw *before* choosing to open the note, so it is
   * occasionally the honest thing to quote — but the note itself is the
   * usual intent.
   */
  preferCw?: boolean
}

/**
 * The shape of a tweet/post that `setFromTweet()` understands.
 *
 * Structural, like `MessageLike`/`NoteLike` — but unlike either, there is no
 * dedicated adapter this package ships that a raw API response passes
 * straight through to: the official API splits a tweet from its author
 * (`author_id`, resolved through a separate `includes.users` array), and
 * FxTwitter spells the fields differently (`screen_name`, `avatar_url`).
 * `fromTwitterApiV2Tweet()` and `fromFxTwitterStatus()` adapt each into this
 * shape.
 */
export interface TweetLike {
  text: string
  author: {
    /** Handle, without the leading `@`. */
    username: string
    /** Display name. Falls back to the handle when absent. */
    name?: string | null
    avatarUrl?: string | null
  }
}

/** One run of text, or one emoji to be drawn as an image. */
export type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'emoji'; source: 'twemoji'; url: string; raw: string }
  | {
      kind: 'emoji'
      source: 'discord'
      url: string
      raw: string
      id: string
      name: string
      animated: boolean
    }
  | {
      kind: 'emoji'
      source: 'misskey'
      url: string
      raw: string
      name: string
      /** Host the emoji belongs to, without a scheme. */
      host: string
      /**
       * Further instances to try if `url` does not serve it.
       *
       * Only set for a bare `:name:` when several instances are configured —
       * the shortcode alone does not say which one it belongs to.
       */
      alternativeUrls?: string[]
    }

/**
 * Misskey custom emoji, written `:name:` or `:name@host:`.
 *
 * Recognised by default. A shortcode is only read as an emoji when it does not
 * follow an ASCII alphanumeric and its name is not purely numeric, which is
 * what keeps `12:30:45` and `http://…` intact. Anything that does not resolve
 * is drawn as the text it was written as.
 */
export interface MisskeyOptions {
  /**
   * The instance bare `:name:` shortcodes belong to, e.g.
   * `https://misskey.example`. Without it, only `:name@host:` resolves and
   * bare shortcodes are left as text.
   *
   * Several may be given, in which case each is tried in order and the first
   * that actually serves the emoji is used — handy for a bot spanning more
   * than one instance, where a shortcode could belong to any of them.
   */
  instance?: string | string[]
  /**
   * Resolve `:name@host:` against the host named in the shortcode.
   * Default true.
   */
  remote?: boolean
}

/** `'jpg'` is accepted everywhere as an alias for `'jpeg'`. */
export type OutputFormat = 'png' | 'jpeg' | 'jpg' | 'webp' | 'avif'

export interface EncodeOptions {
  /** 1–100, default 92. Ignored for PNG, which is lossless. */
  quality?: number
}

/** A font fetched from an explicit URL. */
export interface FontSource {
  family: string
  url: string
  /** File name inside the cache directory. Derived from the URL when omitted. */
  fileName?: string
}

export interface AutoFontOptions {
  /**
   * Default true. Set false to never fetch a font, using only what is already
   * registered, in the disk cache, or installed on the system.
   */
  online?: boolean
  /** Alias for `online`, kept because it reads better on `MiQOptions`. */
  enabled?: boolean
  /** Where downloaded fonts are kept. See `resolveCacheDir()` for the default. */
  cacheDir?: string
  /** Which families `ensureDefaults()` fetches. Defaults to Noto Sans JP. */
  families?: string[]
  /** Download timeout in ms, default 60000. */
  timeout?: number
  /** Called once a family's bytes have arrived. */
  onProgress?: (info: { family: string; received: number; total: number }) => void
}

export interface MiQOptions {
  theme?: ThemePalette | ThemeInput
  /**
   * The Misskey instance bare `:name:` shortcodes belong to.
   *
   * ```ts
   * new MiQ({ misskey: 'https://misskey.example' })
   * ```
   *
   * `:name@host:` resolves without this. See `MisskeyOptions`.
   */
  misskey?: string | MisskeyOptions
  /** Default true. Fetches missing fonts from a CDN on first use. */
  autoFont?: boolean | AutoFontOptions
  /**
   * Throw `FontNotAvailableError` instead of warning when a font is missing.
   *
   * A font-specific override for `onAssetError`: with this unset, a missing
   * font follows `onAssetError` too (`'text'` warns and falls through,
   * `'ignore'` does neither, `'throw'` raises `FontNotAvailableError`).
   */
  strictFonts?: boolean
  /**
   * Sizes the canvas so the avatar is drawn at its native resolution.
   *
   * - `'height'` matches the avatar box's height to the image's
   * - `'width'` matches its width
   *
   * The theme's aspect ratio is kept, so the whole layout scales with it —
   * nothing is stretched. Useful when the avatar is the point and you would
   * rather not resample it at all. Ignored when there is no avatar.
   */
  sizeToAvatar?: 'width' | 'height' | false
  /**
   * What to do when an emoji, avatar or font can't be fetched.
   *
   * - `'text'` (default) draws the raw text an emoji came from, and warns
   *   once for a missing font
   * - `'ignore'` drops it silently — an emoji or avatar just doesn't draw,
   *   and a missing font warns not at all
   * - `'throw'` raises `AssetFetchError` for an emoji or avatar, or
   *   `FontNotAvailableError` for a font
   *
   * `strictFonts` overrides this for fonts specifically.
   */
  onAssetError?: 'ignore' | 'text' | 'throw'
  signal?: AbortSignal
}

/** One message in a `MiQConversation`. */
export interface ConversationMessage {
  text: string
  username: string
  displayName?: string
  avatar?: AvatarSource | null
}

/** `MiQConversation` has two built-in looks, not the full `Theme` system. */
export type ConversationThemeName = 'dark' | 'light'

export interface ConversationOptions {
  theme?: ConversationThemeName
  /** Canvas width in pixels; height follows the content. Default 600. */
  width?: number
  misskey?: string | MisskeyOptions
  autoFont?: boolean | AutoFontOptions
  strictFonts?: boolean
  onAssetError?: 'ignore' | 'text' | 'throw'
  signal?: AbortSignal
}

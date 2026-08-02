import type { Theme, ThemeInput, ThemeName } from '../theme/types'

export type { Theme, ThemeInput, ThemeName }

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
   * On the local renderer this is a shortcut for `setTheme('color')`; the API
   * client sends it verbatim.
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
  theme?: ThemeName | ThemeInput
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

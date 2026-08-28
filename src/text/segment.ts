import { parse as parseTwemoji } from '@twemoji/parser'
import { parseURL } from 'ufo'
import type { MisskeyOptions, Segment } from '../core/types'

/**
 * Discord custom emoji: `<:name:id>`, or `<a:name:id>` when animated.
 *
 * The `<...>` delimiters plus the numeric ID already make this unambiguous,
 * unlike a bare Misskey `:name:` floating in plain text — so unlike that one,
 * a single-character name is still matched. The upper bound and the ID's
 * length still keep this from matching arbitrary angle-bracketed text.
 */
const DISCORD_EMOJI = /<(a)?:(\w{1,32}):(\d{17,20})>/g

/**
 * Misskey custom emoji: `:name:` locally, `:name@host:` for a remote instance.
 *
 * The shortcode may not follow an ASCII alphanumeric, which is what keeps
 * `12:30:45` and `http://…` from being read as emoji — in a timestamp the
 * inner `:30:` always sits directly after a digit. `テキスト:emoji:` still
 * matches, since that is how people actually write them.
 *
 * Names of two or more characters only; purely numeric names are rejected
 * separately, as a second guard against clock-like text.
 */
const MISSKEY_EMOJI = /(?<![A-Za-z0-9_]):([a-z0-9_+-]{2,64})(?:@([a-z0-9.-]+\.[a-z]{2,}|\.))?:/gi

/** `:30:`, `:2024:` — far more likely to be a number than an emoji name. */
const NUMERIC_ONLY = /^\d+$/

export interface SegmentOptions {
  /** Pixel size requested from the Discord CDN. */
  emojiSize?: number
  /** Misskey instance(s), or options. See `MisskeyOptions`. */
  misskey?: string | string[] | MisskeyOptions
}

interface ResolvedMisskey {
  /** Instances to try for a bare shortcode, in order. */
  instances: string[]
  remote: boolean
}

/**
 * Misskey emoji are recognised by default.
 *
 * `:name@host:` carries its own host, so it resolves with no configuration at
 * all. A bare `:name:` needs an instance to point at, so without one it is
 * simply left as text.
 */
function resolveMisskey(options: SegmentOptions): ResolvedMisskey {
  const config = options.misskey

  if (typeof config === 'string') return { instances: hostsOf(config), remote: true }
  if (Array.isArray(config)) return { instances: hostsOf(config), remote: true }
  if (!config) return { instances: [], remote: true }

  return {
    instances: hostsOf(config.instance),
    remote: config.remote !== false,
  }
}

/** Bare hostnames from one or many URLs, dropping any that cannot be read. */
function hostsOf(value: string | string[] | undefined): string[] {
  if (!value) return []
  const list = Array.isArray(value) ? value : [value]
  const hosts: string[] = []
  for (const entry of list) {
    const host = hostOf(entry)
    if (host && !hosts.includes(host)) hosts.push(host)
  }
  return hosts
}

/** A hostname, an IPv6 literal in brackets, or either with a port. */
const HOSTNAME_LIKE = /^[a-z0-9.[\]:-]+$/i

/** Bare hostname from a URL or hostname, with any scheme and path removed. */
function hostOf(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const { host } = parseURL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
  // `parseURL` is lenient where `new URL` throws, so anything with characters
  // a hostname cannot contain is rejected here rather than trusted.
  return host && HOSTNAME_LIKE.test(host) ? host.toLowerCase() : null
}

/**
 * Splits text into runs of characters and emoji to be drawn as images.
 *
 * Standard emoji come from `@twemoji/parser`, which reports absolute indices
 * into the original string, so the runs between them are plain slices. Each of
 * those runs is then scanned for the custom emoji syntaxes.
 */
export function segmentText(text: string, options: SegmentOptions = {}): Segment[] {
  const out: Segment[] = []
  const misskey = resolveMisskey(options)
  let cursor = 0

  for (const entity of parseTwemoji(text, { assetType: 'png' })) {
    const [start, end] = entity.indices
    if (start > cursor) pushText(out, text.slice(cursor, start), options, misskey)
    if (entity.url) {
      out.push({ kind: 'emoji', source: 'twemoji', url: entity.url, raw: entity.text })
    } else {
      pushText(out, entity.text, options, misskey)
    }
    cursor = end
  }

  if (cursor < text.length) pushText(out, text.slice(cursor), options, misskey)

  return out
}

function pushText(
  out: Segment[],
  value: string,
  options: SegmentOptions,
  misskey: ResolvedMisskey,
): void {
  if (value.length === 0) return

  for (const part of splitDiscord(value, options)) {
    if (typeof part === 'string') pushMisskey(out, part, misskey)
    else out.push(part)
  }
}

/** Splits a run on Discord emoji, keeping the text between them as strings. */
function splitDiscord(value: string, options: SegmentOptions): Array<string | Segment> {
  const size = options.emojiSize ?? 64
  const parts: Array<string | Segment> = []
  let cursor = 0

  DISCORD_EMOJI.lastIndex = 0
  for (const match of value.matchAll(DISCORD_EMOJI)) {
    const index = match.index
    if (index > cursor) parts.push(value.slice(cursor, index))

    const animated = match[1] === 'a'
    const name = match[2] as string
    const id = match[3] as string
    parts.push({
      kind: 'emoji',
      source: 'discord',
      url: discordEmojiURL(id, animated, size),
      raw: match[0],
      id,
      name,
      animated,
    })
    cursor = index + match[0].length
  }

  if (cursor < value.length) parts.push(value.slice(cursor))
  return parts
}

/**
 * Splits a run on Misskey shortcodes.
 *
 * Anything that does not resolve — a numeric name, a bare `:name:` with no
 * instance configured, a federated one when `remote` is off — is left exactly
 * as written and drawn as text.
 */
function pushMisskey(out: Segment[], value: string, misskey: ResolvedMisskey): void {
  if (value.length === 0) return

  let cursor = 0
  MISSKEY_EMOJI.lastIndex = 0

  for (const match of value.matchAll(MISSKEY_EMOJI)) {
    const name = match[1] as string
    const suffix = match[2]
    const federated = Boolean(suffix) && suffix !== '.'

    // `:name@.:` is how Misskey writes "this instance" in federated text.
    const hosts = federated ? [suffix as string] : misskey.instances
    const host = hosts[0]

    if (!host) continue
    if (federated && !misskey.remote) continue
    if (NUMERIC_ONLY.test(name)) continue

    const index = match.index
    if (index > cursor) out.push({ kind: 'text', value: value.slice(cursor, index) })

    // Several configured instances means the shortcode could belong to any of
    // them; the loader tries each in turn.
    const alternativeUrls = hosts.slice(1).map((other) => misskeyEmojiURL(other, name))

    out.push({
      kind: 'emoji',
      source: 'misskey',
      url: misskeyEmojiURL(host, name),
      raw: match[0],
      name,
      host,
      ...(alternativeUrls.length > 0 ? { alternativeUrls } : {}),
    })
    cursor = index + match[0].length
  }

  if (cursor < value.length) out.push({ kind: 'text', value: value.slice(cursor) })
}

/**
 * Animated emoji are requested as GIF because that is the only format Discord
 * serves them in; only the first frame ends up being drawn.
 */
export function discordEmojiURL(id: string, animated: boolean, size = 64): string {
  const extension = animated ? 'gif' : 'png'
  return `https://cdn.discordapp.com/emojis/${id}.${extension}?size=${size}`
}

/**
 * Misskey serves custom emoji from `/emoji/{name}.webp` on the owning host.
 *
 * A remote emoji is fetched from the instance it belongs to rather than from
 * the local proxy, so the URL works without knowing anything about the caller's
 * own instance.
 */
export function misskeyEmojiURL(host: string, name: string): string {
  return `https://${host}/emoji/${encodeURIComponent(name)}.webp`
}

/** The text a segment came from, for fallback rendering when an image fails. */
export function segmentSource(segment: Segment): string {
  return segment.kind === 'text' ? segment.value : segment.raw
}

/**
 * Replaces emoji whose image could not be fetched.
 *
 * Run after prefetching and before layout, so that everything downstream deals
 * only in segments that will actually draw as themselves. Doing it here rather
 * than at draw time is what keeps wrapping honest: a shortcode that fell back
 * to text is far wider than the square it stood in for, and — being ordinary
 * text — can now be broken across lines like any other long token.
 */
export function resolveEmojiSegments(
  segments: readonly Segment[],
  hasImage: (url: string) => boolean,
  onMissing: 'ignore' | 'text' | 'throw' = 'text',
): Segment[] {
  const out: Segment[] = []

  for (const segment of segments) {
    if (segment.kind === 'text' || hasImage(segment.url)) {
      push(out, segment)
      continue
    }
    if (onMissing === 'text') push(out, { kind: 'text', value: segment.raw })
    // 'ignore' drops it; 'throw' is handled by the loader before we get here.
  }

  return out
}

/** Appends, merging with the previous run when both are text. */
function push(out: Segment[], segment: Segment): void {
  const previous = out[out.length - 1]
  if (segment.kind === 'text' && previous?.kind === 'text') {
    out[out.length - 1] = { kind: 'text', value: previous.value + segment.value }
    return
  }
  out.push(segment)
}

import type { Image } from '../render/canvasFactory'
import { LRU } from '../util/lru'

export interface EmojiCacheOptions {
  /** Default 256. */
  maxEntries?: number
  /** How long a fetched image stays valid. Default one hour. */
  ttlMs?: number
  /** How long a failed URL is remembered, to stop retry storms. Default 60s. */
  negativeTtlMs?: number
  /** Default true. */
  enabled?: boolean
}

const DEFAULTS = {
  maxEntries: 256,
  ttlMs: 3_600_000,
  negativeTtlMs: 60_000,
  enabled: true,
} satisfies Required<EmojiCacheOptions>

let settings: Required<EmojiCacheOptions> = { ...DEFAULTS }

let images = new LRU<string, Image>({ maxEntries: settings.maxEntries, ttlMs: settings.ttlMs })
let failures = new LRU<string, true>({
  maxEntries: settings.maxEntries,
  ttlMs: settings.negativeTtlMs,
})

/**
 * Requests already in flight, so a burst of messages sharing an emoji only
 * causes one download.
 */
const inFlight = new Map<string, Promise<Image | null>>()

/**
 * Configures the cache shared by every `MiQ` instance in the process.
 *
 * Emoji are the same everywhere, so caching them per instance would mean a bot
 * re-downloading the same images for every message.
 */
export function configureEmojiCache(options: EmojiCacheOptions = {}): void {
  settings = { ...settings, ...options }
  images = new LRU({ maxEntries: settings.maxEntries, ttlMs: settings.ttlMs })
  failures = new LRU({ maxEntries: settings.maxEntries, ttlMs: settings.negativeTtlMs })
  inFlight.clear()
}

export function clearEmojiCache(): void {
  images.clear()
  failures.clear()
  inFlight.clear()
}

export function emojiCacheInfo(): { images: number; failures: number; inFlight: number } {
  return { images: images.size, failures: failures.size, inFlight: inFlight.size }
}

export function cachedImage(url: string): Image | undefined {
  return settings.enabled ? images.get(url) : undefined
}

export function rememberImage(url: string, image: Image): void {
  if (settings.enabled) images.set(url, image)
}

export function isKnownFailure(url: string): boolean {
  return settings.enabled ? failures.has(url) : false
}

export function rememberFailure(url: string): void {
  if (settings.enabled) failures.set(url, true)
}

/**
 * Runs `load` unless the same URL is already loading, in which case the
 * existing promise is shared.
 */
export function coalesce(url: string, load: () => Promise<Image | null>): Promise<Image | null> {
  const existing = inFlight.get(url)
  if (existing) return existing

  const promise = load().finally(() => {
    inFlight.delete(url)
  })
  inFlight.set(url, promise)
  return promise
}

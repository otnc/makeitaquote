import type { Image } from '../render/canvasFactory'
import { type AssetCacheOptions, createAssetCache } from '../util/assetCache'

export type EmojiCacheOptions = AssetCacheOptions

const cache = createAssetCache<Image>({
  maxEntries: 256,
  ttlMs: 3_600_000,
  negativeTtlMs: 60_000,
  enabled: true,
})

/**
 * Configures the cache shared by every `MiQ` instance in the process.
 *
 * Emoji are the same everywhere, so caching them per instance would mean a bot
 * re-downloading the same images for every message.
 */
export function configureEmojiCache(options: EmojiCacheOptions = {}): void {
  cache.configure(options)
}

export function clearEmojiCache(): void {
  cache.clear()
}

export function emojiCacheInfo(): { images: number; failures: number; inFlight: number } {
  const info = cache.info()
  return { images: info.entries, failures: info.failures, inFlight: info.inFlight }
}

export function cachedImage(url: string): Image | undefined {
  return cache.cached(url)
}

export function rememberImage(url: string, image: Image): void {
  cache.remember(url, image)
}

export function isKnownFailure(url: string): boolean {
  return cache.isKnownFailure(url)
}

export function rememberFailure(url: string): void {
  cache.rememberFailure(url)
}

/**
 * Runs `load` unless the same URL is already loading, in which case the
 * existing promise is shared.
 */
export function coalesce(url: string, load: () => Promise<Image | null>): Promise<Image | null> {
  return cache.coalesce(url, load)
}

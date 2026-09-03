import type { Image } from '../render/canvasFactory'
import { type AssetCacheOptions, createAssetCache } from '../util/assetCache'

export type EmojiCacheOptions = AssetCacheOptions

/**
 * The cache shared by every `MiQ` instance in the process.
 *
 * Emoji are the same everywhere, so caching them per instance would mean a bot re-downloading the same images for every message.
 */
export const emojiCache = createAssetCache<Image>({
  maxEntries: 256,
  ttlMs: 3_600_000,
  negativeTtlMs: 60_000,
  enabled: true,
})

export function configureEmojiCache(options: EmojiCacheOptions = {}): void {
  emojiCache.configure(options)
}

export function clearEmojiCache(): void {
  emojiCache.clear()
}

export function emojiCacheInfo(): { images: number; failures: number; inFlight: number } {
  const info = emojiCache.info()
  return { images: info.entries, failures: info.failures, inFlight: info.inFlight }
}

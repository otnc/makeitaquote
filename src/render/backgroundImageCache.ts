import { type AssetCacheOptions, createAssetCache } from '../util/assetCache'
import type { Image } from './canvasFactory'

export type BackgroundImageCacheOptions = AssetCacheOptions

/**
 * The cache for `theme.backgroundImage`, kept separate from `avatarCache`
 * (see `assetCache.ts` for why unrelated asset kinds get their own instance):
 * a background is typically one of a handful of fixed, reused assets rather
 * than a different picture per user, so it gets a longer TTL and far fewer
 * slots than avatars — and a burst of avatar fetches can no longer evict it.
 */
export const backgroundImageCache = createAssetCache<Image>({
  maxEntries: 16,
  ttlMs: 30 * 60_000,
  negativeTtlMs: 30_000,
  enabled: true,
})

export function configureBackgroundImageCache(options: BackgroundImageCacheOptions = {}): void {
  backgroundImageCache.configure(options)
}

export function clearBackgroundImageCache(): void {
  backgroundImageCache.clear()
}

export function backgroundImageCacheInfo(): {
  images: number
  failures: number
  inFlight: number
} {
  const info = backgroundImageCache.info()
  return { images: info.entries, failures: info.failures, inFlight: info.inFlight }
}

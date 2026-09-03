import { type AssetCacheOptions, createAssetCache } from '../util/assetCache'
import type { Image } from './canvasFactory'

export type AvatarCacheOptions = AssetCacheOptions

/** The cache shared by every `MiQ` instance in the process. */
export const avatarCache = createAssetCache<Image>({
  maxEntries: 64,
  // Much shorter than the emoji cache: an avatar is one specific user's current picture, not a shared asset, and can change. This is only meant to dedupe a burst of quotes for the same user within a few minutes, not to serve a stale picture long after it stopped being true.
  ttlMs: 300_000,
  negativeTtlMs: 30_000,
  enabled: true,
})

export function configureAvatarCache(options: AvatarCacheOptions = {}): void {
  avatarCache.configure(options)
}

export function clearAvatarCache(): void {
  avatarCache.clear()
}

export function avatarCacheInfo(): { images: number; failures: number; inFlight: number } {
  const info = avatarCache.info()
  return { images: info.entries, failures: info.failures, inFlight: info.inFlight }
}

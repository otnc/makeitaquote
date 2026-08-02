import { type AssetCacheOptions, createAssetCache } from '../util/assetCache'
import type { Image } from './canvasFactory'

export type AvatarCacheOptions = AssetCacheOptions

const cache = createAssetCache<Image>({
  maxEntries: 64,
  // Much shorter than the emoji cache: an avatar is one specific user's
  // current picture, not a shared asset, and can change. This is only meant
  // to dedupe a burst of quotes for the same user within a few minutes, not
  // to serve a stale picture long after it stopped being true.
  ttlMs: 300_000,
  negativeTtlMs: 30_000,
  enabled: true,
})

/**
 * Configures the cache shared by every `MiQ` instance in the process.
 */
export function configureAvatarCache(options: AvatarCacheOptions = {}): void {
  cache.configure(options)
}

export function clearAvatarCache(): void {
  cache.clear()
}

export function avatarCacheInfo(): { images: number; failures: number; inFlight: number } {
  const info = cache.info()
  return { images: info.entries, failures: info.failures, inFlight: info.inFlight }
}

export function cachedAvatar(key: string): Image | undefined {
  return cache.cached(key)
}

export function rememberAvatar(key: string, image: Image): void {
  cache.remember(key, image)
}

export function isKnownAvatarFailure(key: string): boolean {
  return cache.isKnownFailure(key)
}

export function rememberAvatarFailure(key: string): void {
  cache.rememberFailure(key)
}

/**
 * Runs `load` unless the same key is already loading, in which case the
 * existing promise is shared.
 */
export function coalesceAvatar(
  key: string,
  load: () => Promise<Image | null>,
): Promise<Image | null> {
  return cache.coalesce(key, load)
}

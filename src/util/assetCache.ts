import { type LRU, lru } from 'tiny-lru'

export interface AssetCacheOptions {
  /** `0` disables storing entirely, the same as `enabled: false`. */
  maxEntries?: number
  ttlMs?: number
  negativeTtlMs?: number
  enabled?: boolean
}

export interface AssetCacheInfo {
  entries: number
  failures: number
  inFlight: number
}

export interface AssetCache<V> {
  configure(options: AssetCacheOptions): void
  clear(): void
  info(): AssetCacheInfo
  cached(key: string): V | undefined
  remember(key: string, value: V): void
  isKnownFailure(key: string): boolean
  rememberFailure(key: string): void
  /** Runs `load` unless `key` is already loading, sharing that promise instead. */
  coalesce(key: string, load: () => Promise<V | null>): Promise<V | null>
}

/**
 * A positive/negative LRU plus in-flight de-duplication — the shape every
 * "fetch this, decode it, remember the result" cache in this package needs.
 *
 * Emoji and avatars each get their own instance rather than sharing one: a
 * burst of avatar fetches evicting emoji a bot just downloaded (or the
 * reverse) would be a strange coupling between two unrelated kinds of asset.
 */
export function createAssetCache<V>(defaults: Required<AssetCacheOptions>): AssetCache<V> {
  let settings: Required<AssetCacheOptions> = { ...defaults }
  let values = build<V>(settings.maxEntries, settings.ttlMs)
  let failures = build<true>(settings.maxEntries, settings.negativeTtlMs)
  const inFlight = new Map<string, Promise<V | null>>()

  /**
   * `tiny-lru`'s `max: 0` means unlimited, the opposite of `maxEntries: 0`
   * here, so that case returns `null` instead — every read/write below
   * treats that as a miss. `ttl: 0` already means "never expires" in
   * `tiny-lru`, matching this cache's own convention, so `ttlMs` passes
   * through as-is.
   */
  function build<T>(maxEntries: number, ttlMs: number): LRU<T> | null {
    if (maxEntries <= 0) return null
    return lru<T>(maxEntries, ttlMs)
  }

  /** Storing is off when the cache is disabled, or sized out of existence. */
  const storing = () => settings.enabled

  return {
    configure(options) {
      settings = { ...settings, ...options }
      values = build<V>(settings.maxEntries, settings.ttlMs)
      failures = build<true>(settings.maxEntries, settings.negativeTtlMs)
      inFlight.clear()
    },
    clear() {
      values?.clear()
      failures?.clear()
      inFlight.clear()
    },
    info() {
      return {
        entries: values?.size ?? 0,
        failures: failures?.size ?? 0,
        inFlight: inFlight.size,
      }
    },
    cached(key) {
      return storing() ? values?.get(key) : undefined
    },
    remember(key, value) {
      if (storing()) values?.set(key, value)
    },
    isKnownFailure(key) {
      return storing() ? (failures?.has(key) ?? false) : false
    },
    rememberFailure(key) {
      if (storing()) failures?.set(key, true)
    },
    coalesce(key, load) {
      const existing = inFlight.get(key)
      if (existing) return existing

      const promise = load().finally(() => {
        inFlight.delete(key)
      })
      inFlight.set(key, promise)
      return promise
    },
  }
}

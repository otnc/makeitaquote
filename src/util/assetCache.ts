import { LRU } from './lru'

export interface AssetCacheOptions {
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
  let values = new LRU<string, V>({ maxEntries: settings.maxEntries, ttlMs: settings.ttlMs })
  let failures = new LRU<string, true>({
    maxEntries: settings.maxEntries,
    ttlMs: settings.negativeTtlMs,
  })
  const inFlight = new Map<string, Promise<V | null>>()

  return {
    configure(options) {
      settings = { ...settings, ...options }
      values = new LRU({ maxEntries: settings.maxEntries, ttlMs: settings.ttlMs })
      failures = new LRU({ maxEntries: settings.maxEntries, ttlMs: settings.negativeTtlMs })
      inFlight.clear()
    },
    clear() {
      values.clear()
      failures.clear()
      inFlight.clear()
    },
    info() {
      return { entries: values.size, failures: failures.size, inFlight: inFlight.size }
    },
    cached(key) {
      return settings.enabled ? values.get(key) : undefined
    },
    remember(key, value) {
      if (settings.enabled) values.set(key, value)
    },
    isKnownFailure(key) {
      return settings.enabled ? failures.has(key) : false
    },
    rememberFailure(key) {
      if (settings.enabled) failures.set(key, true)
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

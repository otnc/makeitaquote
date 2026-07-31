export interface LRUOptions {
  maxEntries?: number
  /** Entries older than this are treated as missing. `0` disables expiry. */
  ttlMs?: number
  /** Injectable clock, so tests don't have to wait. */
  now?: () => number
}

interface Entry<V> {
  value: V
  storedAt: number
}

/**
 * A small LRU with optional TTL.
 *
 * Built on `Map`'s insertion order — re-inserting a key moves it to the end,
 * so the oldest entry is always the first one iteration yields. That is the
 * whole trick, and it keeps this dependency-free.
 */
export class LRU<K, V> {
  #entries = new Map<K, Entry<V>>()
  #maxEntries: number
  #ttlMs: number
  #now: () => number

  constructor(options: LRUOptions = {}) {
    this.#maxEntries = Math.max(0, options.maxEntries ?? 256)
    this.#ttlMs = Math.max(0, options.ttlMs ?? 0)
    this.#now = options.now ?? Date.now
  }

  get size(): number {
    return this.#entries.size
  }

  get(key: K): V | undefined {
    const entry = this.#entries.get(key)
    if (!entry) return undefined

    if (this.#expired(entry)) {
      this.#entries.delete(key)
      return undefined
    }

    // Refresh recency.
    this.#entries.delete(key)
    this.#entries.set(key, entry)
    return entry.value
  }

  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  set(key: K, value: V): void {
    if (this.#maxEntries === 0) return

    this.#entries.delete(key)
    this.#entries.set(key, { value, storedAt: this.#now() })

    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next()
      if (oldest.done) break
      this.#entries.delete(oldest.value)
    }
  }

  delete(key: K): boolean {
    return this.#entries.delete(key)
  }

  clear(): void {
    this.#entries.clear()
  }

  /** Keys from least to most recently used, skipping expired entries. */
  keys(): K[] {
    const out: K[] = []
    for (const [key, entry] of this.#entries) {
      if (!this.#expired(entry)) out.push(key)
    }
    return out
  }

  #expired(entry: Entry<V>): boolean {
    return this.#ttlMs > 0 && this.#now() - entry.storedAt >= this.#ttlMs
  }
}

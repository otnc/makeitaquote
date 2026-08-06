import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAssetCache } from './assetCache'

/** The emoji cache's shape, small enough to make eviction easy to trigger. */
function cache() {
  return createAssetCache<string>({
    maxEntries: 2,
    ttlMs: 1000,
    negativeTtlMs: 500,
    enabled: true,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createAssetCache', () => {
  it('remembers and returns a value', () => {
    const c = cache()
    c.remember('a', 'A')

    expect(c.cached('a')).toBe('A')
    expect(c.info().entries).toBe(1)
  })

  it('misses on a key it never saw', () => {
    expect(cache().cached('nope')).toBeUndefined()
  })

  it('evicts the least recently used past maxEntries', () => {
    const c = cache()
    c.remember('a', 'A')
    c.remember('b', 'B')
    c.cached('a') // 'a' is now the more recent of the two
    c.remember('c', 'C')

    expect(c.cached('c')).toBe('C')
    expect(c.info().entries).toBeLessThanOrEqual(2)
  })

  it('forgets a value once its ttl has passed', () => {
    const c = cache()
    c.remember('a', 'A')

    vi.advanceTimersByTime(999)
    expect(c.cached('a')).toBe('A')

    vi.advanceTimersByTime(2)
    expect(c.cached('a')).toBeUndefined()
  })

  it('keeps failures on their own, shorter ttl', () => {
    const c = cache()
    c.rememberFailure('x')

    expect(c.isKnownFailure('x')).toBe(true)

    vi.advanceTimersByTime(501)
    expect(c.isKnownFailure('x')).toBe(false)
  })

  it('stores nothing at all when disabled', () => {
    const c = cache()
    c.configure({ enabled: false })
    c.remember('a', 'A')
    c.rememberFailure('x')

    expect(c.cached('a')).toBeUndefined()
    expect(c.isKnownFailure('x')).toBe(false)
  })

  // tiny-lru's own `max: 0` means unlimited, the opposite of what it means
  // here, so this is the case worth pinning: it has to keep meaning "remember
  // nothing" regardless of what the underlying library does with a 0.
  it('stores nothing when sized to zero, without throwing', () => {
    const c = cache()

    expect(() => c.configure({ maxEntries: 0 })).not.toThrow()

    c.remember('a', 'A')
    expect(c.cached('a')).toBeUndefined()
    expect(c.info().entries).toBe(0)
  })

  it('treats a ttl of 0 as never expiring', () => {
    const c = cache()
    c.configure({ ttlMs: 0 })
    c.remember('a', 'A')

    vi.advanceTimersByTime(10_000_000)
    expect(c.cached('a')).toBe('A')
  })

  it('empties on clear, keeping the settings', () => {
    const c = cache()
    c.remember('a', 'A')
    c.clear()

    expect(c.cached('a')).toBeUndefined()

    c.remember('b', 'B')
    expect(c.cached('b')).toBe('B')
  })

  it('drops everything stored when reconfigured', () => {
    const c = cache()
    c.remember('a', 'A')
    c.configure({ maxEntries: 10 })

    expect(c.cached('a')).toBeUndefined()
  })

  describe('coalesce', () => {
    it('shares one promise between concurrent callers', async () => {
      const c = cache()
      let calls = 0
      const load = () => {
        calls++
        return Promise.resolve('A')
      }

      const [first, second] = await Promise.all([c.coalesce('a', load), c.coalesce('a', load)])

      expect(calls).toBe(1)
      expect(first).toBe(second)
    })

    it('runs again once the first has settled', async () => {
      const c = cache()
      let calls = 0
      const load = () => {
        calls++
        return Promise.resolve('A')
      }

      await c.coalesce('a', load)
      await c.coalesce('a', load)

      expect(calls).toBe(2)
    })

    it('stops tracking a key whose load rejected', async () => {
      const c = cache()
      const boom = () => Promise.reject(new Error('boom'))

      await expect(c.coalesce('a', boom)).rejects.toThrow('boom')
      expect(c.info().inFlight).toBe(0)
    })
  })
})

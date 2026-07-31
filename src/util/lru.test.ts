import { describe, expect, it } from 'vitest'
import { LRU } from './lru'

function clock(start = 0) {
  const state = { t: start }
  return { now: () => state.t, advance: (ms: number) => (state.t += ms) }
}

describe('LRU', () => {
  it('stores and returns values', () => {
    const cache = new LRU<string, number>()
    cache.set('a', 1)

    expect(cache.get('a')).toBe(1)
    expect(cache.size).toBe(1)
  })

  it('returns undefined for a missing key', () => {
    expect(new LRU<string, number>().get('nope')).toBeUndefined()
  })

  it('evicts the least recently used entry when full', () => {
    const cache = new LRU<string, number>({ maxEntries: 2 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
  })

  it('counts a read as a use', () => {
    const cache = new LRU<string, number>({ maxEntries: 2 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a')
    cache.set('c', 3)

    // 'b' was the stale one this time, not 'a'.
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeUndefined()
  })

  it('overwrites without growing', () => {
    const cache = new LRU<string, number>({ maxEntries: 2 })
    cache.set('a', 1)
    cache.set('a', 2)

    expect(cache.size).toBe(1)
    expect(cache.get('a')).toBe(2)
  })

  it('reports keys from least to most recently used', () => {
    const cache = new LRU<string, number>()
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a')

    expect(cache.keys()).toEqual(['b', 'a'])
  })

  it('expires entries past the ttl', () => {
    const time = clock()
    const cache = new LRU<string, number>({ ttlMs: 100, now: time.now })
    cache.set('a', 1)

    time.advance(99)
    expect(cache.get('a')).toBe(1)

    time.advance(1)
    expect(cache.get('a')).toBeUndefined()
  })

  it('keeps entries forever when no ttl is set', () => {
    const time = clock()
    const cache = new LRU<string, number>({ now: time.now })
    cache.set('a', 1)

    time.advance(1_000_000)
    expect(cache.get('a')).toBe(1)
  })

  it('drops expired keys from keys()', () => {
    const time = clock()
    const cache = new LRU<string, number>({ ttlMs: 100, now: time.now })
    cache.set('a', 1)
    time.advance(101)
    cache.set('b', 2)

    expect(cache.keys()).toEqual(['b'])
  })

  it('stores nothing when maxEntries is zero', () => {
    const cache = new LRU<string, number>({ maxEntries: 0 })
    cache.set('a', 1)

    expect(cache.get('a')).toBeUndefined()
    expect(cache.size).toBe(0)
  })

  it('clears', () => {
    const cache = new LRU<string, number>()
    cache.set('a', 1)
    cache.clear()

    expect(cache.size).toBe(0)
  })

  it('deletes a single key', () => {
    const cache = new LRU<string, number>()
    cache.set('a', 1)

    expect(cache.delete('a')).toBe(true)
    expect(cache.delete('a')).toBe(false)
  })
})

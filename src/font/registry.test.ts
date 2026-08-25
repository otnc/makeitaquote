import { describe, expect, it } from 'vitest'
import { resolveFamily } from './registry'

describe('resolveFamily', () => {
  it('recognizes every CSS generic keyword without registration', () => {
    for (const generic of ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy']) {
      expect(resolveFamily(generic)).toBe(generic)
    }
  })

  it('is null for an empty stack', () => {
    expect(resolveFamily('')).toBeNull()
  })
})

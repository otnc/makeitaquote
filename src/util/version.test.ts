import { describe, expect, it } from 'vitest'
import { isNewerVersion } from './version'

describe('isNewerVersion', () => {
  it('is true when the minor version increases', () => {
    expect(isNewerVersion('9.0.1', '9.1.0')).toBe(true)
  })

  it('is false when the versions are equal', () => {
    expect(isNewerVersion('9.1.0', '9.1.0')).toBe(false)
  })

  it('is false when latest is older', () => {
    expect(isNewerVersion('9.1.0', '9.0.1')).toBe(false)
  })

  it('treats a missing segment as zero', () => {
    expect(isNewerVersion('1.0', '1.0.1')).toBe(true)
    expect(isNewerVersion('1.0.1', '1.0')).toBe(false)
  })

  it('strips a leading v so tag styles compare the same way', () => {
    expect(isNewerVersion('v30', 'v31')).toBe(true)
    expect(isNewerVersion('30', 'v31')).toBe(true)
  })

  it('compares left to right by numeric value, not lexically', () => {
    expect(isNewerVersion('1.9.0', '1.10.0')).toBe(true)
  })

  it('falls back to treating an unparseable segment as zero', () => {
    // "not-a-version" has no digits at all, so every segment is 0 — the same
    // as comparing against "0.0.0".
    expect(isNewerVersion('1.0.0', 'not-a-version')).toBe(false)
    expect(isNewerVersion('not-a-version', '1.0.0')).toBe(true)
  })

  it('does not treat a prerelease as newer than the release it precedes', () => {
    expect(isNewerVersion('12.0.0', '12.0.0-rc.1')).toBe(false)
  })

  it('does not treat a release as newer than its own prerelease', () => {
    // Not full semver — a prerelease and its release compare as equal here —
    // but it must never flip in the wrong direction (see the previous case).
    expect(isNewerVersion('12.0.0-rc.1', '12.0.0')).toBe(false)
  })

  it('ignores build metadata the same way', () => {
    expect(isNewerVersion('1.2.3+build5', '1.2.3')).toBe(false)
    expect(isNewerVersion('1.2.3', '1.2.3+build5')).toBe(false)
  })
})

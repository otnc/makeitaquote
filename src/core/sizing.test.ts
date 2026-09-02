import process from 'node:process'
import { resetDeprecationsForTests } from '@makeitaquote/utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeLayout, sizeToAvatar } from '../render/layout'
import { defineTheme } from '../theme/resolve'
import { ValidationError } from './errors'
import { MiQ } from './MiQ'

beforeEach(() => {
  resetDeprecationsForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('default size', () => {
  it('is 630 tall in landscape', () => {
    expect(new MiQ().getTheme().height).toBe(630)
  })

  it('is 630 wide with the new layout', () => {
    expect(new MiQ({ theme: { layout: 'new' } }).getTheme().width).toBe(630)
  })

  it('matches what api.voids.top itself renders at, not a round ratio', () => {
    const { width, height } = new MiQ().getTheme()

    expect([width, height]).toEqual([1200, 630])
  })
})

describe('setScale', () => {
  it('multiplies both dimensions', () => {
    const base = new MiQ().getTheme()
    const scaled = new MiQ().setScale(2).getTheme()

    expect(scaled.width).toBe(base.width * 2)
    expect(scaled.height).toBe(base.height * 2)
  })

  it('keeps the aspect ratio exactly', () => {
    const base = new MiQ().getTheme()
    const scaled = new MiQ().setScale(0.5).getTheme()

    expect(scaled.width / scaled.height).toBeCloseTo(base.width / base.height, 3)
  })

  it('compounds', () => {
    const twice = new MiQ().setScale(2).setScale(2).getTheme()

    expect(twice.height).toBe(2520)
  })

  it('emits no deprecation warning', () => {
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})

    new MiQ().setScale(2)

    expect(warn).not.toHaveBeenCalled()
  })

  it('rejects a non-positive factor', () => {
    expect(() => new MiQ().setScale(0)).toThrow(ValidationError)
    expect(() => new MiQ().setScale(-1)).toThrow(ValidationError)
    expect(() => new MiQ().setScale(Number.NaN)).toThrow(ValidationError)
  })

  it('rejects an absurd factor', () => {
    expect(() => new MiQ().setScale(100)).toThrow(/at most/)
  })
})

describe('setSize', () => {
  it('still works', () => {
    vi.spyOn(process, 'emitWarning').mockImplementation(() => {})

    const theme = new MiQ().setSize(640, 360).getTheme()

    expect([theme.width, theme.height]).toEqual([640, 360])
  })

  it('warns that it is deprecated', () => {
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})

    new MiQ().setSize(640, 360)

    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[1]).toMatchObject({ type: 'DeprecationWarning' })
  })

  it('points at the replacement', () => {
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})

    new MiQ().setSize(640, 360)

    expect(warn.mock.calls[0]?.[0]).toContain('setScale')
  })

  it('warns only once per process', () => {
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})

    new MiQ().setSize(640, 360)
    new MiQ().setSize(800, 600)

    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('sizeToAvatar', () => {
  const theme = defineTheme('dark')

  it('leaves the theme alone when switched off', () => {
    expect(sizeToAvatar(theme, { width: 1024, height: 1024 }, false)).toBe(theme)
  })

  it('leaves the theme alone when there is no image', () => {
    expect(sizeToAvatar(theme, null, 'height')).toBe(theme)
  })

  it('matches the avatar box height to the image', () => {
    const resized = sizeToAvatar(theme, { width: 1024, height: 1024 }, 'height')

    expect(computeLayout(resized).avatar.height).toBeCloseTo(1024, 0)
  })

  it('matches the avatar box width to the image', () => {
    const resized = sizeToAvatar(theme, { width: 1024, height: 1024 }, 'width')

    expect(computeLayout(resized).avatar.width).toBeCloseTo(1024, 0)
  })

  it('keeps the aspect ratio, so nothing is stretched', () => {
    const resized = sizeToAvatar(theme, { width: 1024, height: 1024 }, 'height')

    expect(resized.width / resized.height).toBeCloseTo(theme.width / theme.height, 2)
  })

  it('works for the new layout, where the avatar is the whole canvas', () => {
    const newLayout = defineTheme({ layout: 'new' })
    const resized = sizeToAvatar(newLayout, { width: 1024, height: 1024 }, 'width')

    expect(resized.width).toBe(1024)
  })

  it('ignores a degenerate image', () => {
    expect(sizeToAvatar(theme, { width: 0, height: 0 }, 'height')).toBe(theme)
  })
})

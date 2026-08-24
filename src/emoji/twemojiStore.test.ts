import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveCacheDir } from '../font/diskCache'
import {
  installTwemoji,
  localTwemojiFile,
  resolveTwemojiDir,
  type TwemojiFetcher,
  twemojiFileName,
  twemojiInfo,
  uninstallTwemoji,
} from './twemojiStore'

let dir = ''

/** A stand-in for the jsDelivr listing — three images is plenty. */
const LISTING = { version: '17.0.3', files: ['1f44d.png', '1f600.png', '1f642.png'] }

function pngFetcher(bytes = Buffer.from('png-bytes')): TwemojiFetcher & { calls: string[] } {
  const calls: string[] = []
  const fetcher = (async (url: string) => {
    calls.push(url)
    return bytes
  }) as TwemojiFetcher & { calls: string[] }
  fetcher.calls = calls
  return fetcher
}

const CDN = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/72x72'

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'miq-twemoji-test-'))
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  await rm(dir, { recursive: true, force: true })
})

describe('twemojiFileName', () => {
  it('maps a CDN url to its file name, whatever version tag it carries', () => {
    expect(
      twemojiFileName('https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f642.png'),
    ).toBe('1f642.png')
    expect(twemojiFileName(`${CDN}/1f1ef-1f1f5.png`)).toBe('1f1ef-1f1f5.png')
  })

  it('rejects anything that is not a Twemoji CDN png', () => {
    expect(twemojiFileName('https://cdn.test/1f642.png')).toBeNull()
    expect(twemojiFileName('https://cdn.jsdelivr.net/gh/other/assets/72x72/1f642.png')).toBeNull()
    expect(
      twemojiFileName('https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/1f642.svg'),
    ).toBeNull()
    expect(twemojiFileName('not a url')).toBeNull()
  })
})

describe('resolveTwemojiDir', () => {
  it('prefers an explicit override', () => {
    expect(resolveTwemojiDir('/somewhere')).toBe('/somewhere')
  })

  it('reads MIQ_TWEMOJI_CACHE_DIR', () => {
    vi.stubEnv('MIQ_TWEMOJI_CACHE_DIR', '/from-env')

    expect(resolveTwemojiDir()).toBe('/from-env')
  })

  it('sits beside the font cache by default', () => {
    vi.stubEnv('MIQ_FONT_CACHE_DIR', '/cache/fonts')

    expect(resolveTwemojiDir()).toBe(join(dirname(resolveCacheDir()), 'twemoji'))
    expect(resolveTwemojiDir()).toContain('twemoji')
  })
})

describe('installTwemoji', () => {
  it('downloads every listed image from the CDN', async () => {
    const fetcher = pngFetcher()

    const result = await installTwemoji({ dir, list: async () => LISTING, fetcher })

    expect(fetcher.calls.sort()).toEqual([
      `${CDN}/1f44d.png`,
      `${CDN}/1f600.png`,
      `${CDN}/1f642.png`,
    ])
    expect(result).toMatchObject({ version: '17.0.3', total: 3, downloaded: 3, skipped: 0 })
  })

  it('writes the images and a manifest into the directory', async () => {
    await installTwemoji({ dir, list: async () => LISTING, fetcher: pngFetcher() })

    expect((await readdir(dir)).sort()).toEqual([
      '1f44d.png',
      '1f600.png',
      '1f642.png',
      'manifest.json',
    ])
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as {
      version: string
      count: number
    }
    expect(manifest).toMatchObject({ version: '17.0.3', count: 3 })
  })

  it('skips images already on disk', async () => {
    const fetcher = pngFetcher()
    await installTwemoji({ dir, list: async () => LISTING, fetcher })
    const again = await installTwemoji({ dir, list: async () => LISTING, fetcher })

    expect(again).toMatchObject({ downloaded: 0, skipped: 3 })
    expect(fetcher.calls).toHaveLength(3)
  })

  it('reports progress as images land', async () => {
    const onProgress = vi.fn()

    await installTwemoji({ dir, list: async () => LISTING, fetcher: pngFetcher(), onProgress })

    expect(onProgress).toHaveBeenLastCalledWith(3, 3)
    expect(onProgress).toHaveBeenCalledTimes(3)
  })
})

describe('localTwemojiFile', () => {
  it('finds an installed image for its CDN url', async () => {
    await installTwemoji({ dir, list: async () => LISTING, fetcher: pngFetcher() })

    expect(localTwemojiFile(`${CDN}/1f642.png`, dir)).toBe(join(dir, '1f642.png'))
  })

  it('stays null for uninstalled images and other urls', async () => {
    await installTwemoji({ dir, list: async () => LISTING, fetcher: pngFetcher() })

    expect(localTwemojiFile(`${CDN}/1f9ff.png`, dir)).toBeNull()
    expect(localTwemojiFile('https://cdn.test/1f642.png', dir)).toBeNull()
  })
})

describe('twemojiInfo', () => {
  it('counts images, bytes and the installed version', async () => {
    await installTwemoji({ dir, list: async () => LISTING, fetcher: pngFetcher(Buffer.alloc(10)) })

    const info = await twemojiInfo(dir)

    expect(info).toMatchObject({ dir, images: 3, bytes: 30, version: '17.0.3' })
  })

  it('reports nothing for a missing directory', async () => {
    const info = await twemojiInfo(join(dir, 'nope'))

    expect(info).toMatchObject({ images: 0, bytes: 0, version: null })
  })
})

describe('uninstallTwemoji', () => {
  it('removes the directory and everything in it', async () => {
    await installTwemoji({ dir, list: async () => LISTING, fetcher: pngFetcher() })

    await uninstallTwemoji(dir)

    await expect(readdir(dir)).rejects.toThrow()
  })

  it('is a no-op when nothing is installed', async () => {
    await expect(uninstallTwemoji(join(dir, 'nope'))).resolves.toBeUndefined()
  })
})

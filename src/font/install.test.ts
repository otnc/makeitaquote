import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAutoloadForTests } from './autoload'
import { installFonts, listInstalledFonts, pruneFonts, uninstallFonts } from './install'

let dir = ''

/** A family nothing on the system provides, so resolution always runs. */
function unusedFamily(): string {
  return `Test Family ${Math.random().toString(36).slice(2)}`
}

/** Stands in for the Google Fonts CSS API, serving both default weights. */
function stubGoogleFonts(family: string) {
  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input)
    if (!url.includes('fonts.googleapis.com')) throw new Error(`unexpected fetch: ${url}`)
    return new Response(
      [400, 700]
        .map(
          (weight) => `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  src: url(https://fonts.gstatic.com/s/test/v9/hash-${weight}.ttf) format('truetype');
}`,
        )
        .join('\n'),
      { status: 200, headers: { 'content-type': 'text/css' } },
    )
  })
}

function fontFetcher(): { fetcher: (url: string) => Promise<Buffer>; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    fetcher: async (url: string) => {
      calls.push(url)
      return Buffer.from('font-bytes')
    },
  }
}

/** Cache file names as `fileNameFor` would write them. */
const M_PLUS_400 = 'M-PLUS-Rounded-1c-v15-400-abc123.ttf'
const M_PLUS_700 = 'M-PLUS-Rounded-1c-v15-700-def456.ttf'
const M_PLUS_400_OLD = 'M-PLUS-Rounded-1c-v14-400-stale1.ttf'
const M_PLUS_700_OLD = 'M-PLUS-Rounded-1c-v14-700-stale2.ttf'
const NOTO_400 = 'Noto-Sans-JP-v53-400-ghi789.ttf'

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'miq-font-install-test-'))
  resetAutoloadForTests()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await rm(dir, { recursive: true, force: true })
})

describe('installFonts', () => {
  it('downloads both default weights into the cache', async () => {
    const family = unusedFamily()
    stubGoogleFonts(family)
    const { fetcher, calls } = fontFetcher()

    const results = await installFonts([family], { cacheDir: dir, fetcher })

    expect(results).toEqual([{ family, ok: true }])
    expect(calls).toHaveLength(2)
    expect(await readdir(dir)).toHaveLength(2)
  })

  it('does not fetch again when the files are already cached', async () => {
    const family = unusedFamily()
    stubGoogleFonts(family)
    const { fetcher, calls } = fontFetcher()

    await installFonts([family], { cacheDir: dir, fetcher })
    resetAutoloadForTests()
    await installFonts([family], { cacheDir: dir, fetcher })

    expect(calls).toHaveLength(2)
  })

  it('reports a family Google does not serve', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 400 }))

    const results = await installFonts(['Definitely Not A Font'], {
      cacheDir: dir,
      fetcher: fontFetcher().fetcher,
    })

    expect(results).toEqual([{ family: 'Definitely Not A Font', ok: false }])
  })

  it('resolves a FONT_ALIASES short name and reports the real family', async () => {
    stubGoogleFonts('M PLUS Rounded 1c')
    const { fetcher } = fontFetcher()

    const results = await installFonts(['mplus'], { cacheDir: dir, fetcher })

    expect(results).toEqual([{ family: 'M PLUS Rounded 1c', ok: true }])
    expect(await readdir(dir)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^M-PLUS-Rounded-1c-/)]),
    )
  })
})

describe('uninstallFonts', () => {
  it('removes only the named family, by slug', async () => {
    await writeFile(join(dir, M_PLUS_400), 'a')
    await writeFile(join(dir, M_PLUS_700), 'a')
    await writeFile(join(dir, NOTO_400), 'a')

    const removed = await uninstallFonts(['M PLUS Rounded 1c'], dir)

    expect(removed).toBe(2)
    expect(await readdir(dir)).toEqual([NOTO_400])
  })

  it('resolves a FONT_ALIASES short name to the same slug as the real name', async () => {
    await writeFile(join(dir, M_PLUS_400), 'a')
    await writeFile(join(dir, M_PLUS_700), 'a')
    await writeFile(join(dir, NOTO_400), 'a')

    const removed = await uninstallFonts(['mplus'], dir)

    expect(removed).toBe(2)
    expect(await readdir(dir)).toEqual([NOTO_400])
  })

  it('removes the whole cache with no families', async () => {
    await writeFile(join(dir, M_PLUS_400), 'a')
    await writeFile(join(dir, NOTO_400), 'a')

    const removed = await uninstallFonts(undefined, dir)

    expect(removed).toBe(2)
    await expect(readdir(dir)).rejects.toThrow()
  })

  it('is a no-op when nothing matches', async () => {
    await expect(uninstallFonts(['Nope'], dir)).resolves.toBe(0)
    await expect(uninstallFonts(undefined, dir)).resolves.toBe(0)
  })

  it('rethrows a real deletion failure instead of swallowing it', async () => {
    // A directory where a cache file is expected: unlink fails with EISDIR/EPERM, never ENOENT, so this must propagate rather than being counted as "already gone".
    await mkdir(join(dir, M_PLUS_400), { recursive: true })

    await expect(uninstallFonts(['M PLUS Rounded 1c'], dir)).rejects.toThrow()
  })
})

describe('listInstalledFonts', () => {
  it('groups files by family, with weights and sizes', async () => {
    await writeFile(join(dir, M_PLUS_400), 'a')
    await writeFile(join(dir, M_PLUS_700), 'bb')
    await writeFile(join(dir, NOTO_400), 'ccc')

    const fonts = listInstalledFonts(dir)

    expect(fonts).toHaveLength(2)
    const mPlus = fonts.find((font) => font.family === 'M PLUS Rounded 1c')
    expect(mPlus).toMatchObject({ files: 2, bytes: 3, weights: [400, 700], italic: false })
    expect(fonts.find((font) => font.family === 'Noto Sans JP')).toMatchObject({
      files: 1,
      weights: [400],
    })
  })

  it('notes italic faces', async () => {
    await writeFile(join(dir, 'Some-Font-v1-400-italic-abc.ttf'), 'a')

    expect(listInstalledFonts(dir)[0]).toMatchObject({ family: 'Some Font', italic: true })
  })

  it('ignores files that are not cache names', async () => {
    await writeFile(join(dir, 'readme.txt'), 'a')
    await writeFile(join(dir, 'stray.ttf'), 'a')

    expect(listInstalledFonts(dir)).toEqual([])
  })

  it('returns nothing for a missing directory', () => {
    expect(listInstalledFonts(join(dir, 'nope'))).toEqual([])
  })
})

describe('pruneFonts', () => {
  it('removes stale-version files, keeping the newest', async () => {
    await writeFile(join(dir, M_PLUS_400), 'aa')
    await writeFile(join(dir, M_PLUS_700), 'aa')
    await writeFile(join(dir, M_PLUS_400_OLD), 'a')
    await writeFile(join(dir, M_PLUS_700_OLD), 'a')
    await writeFile(join(dir, NOTO_400), 'aaa')

    const results = await pruneFonts(undefined, dir)

    expect(results).toEqual([{ family: 'M PLUS Rounded 1c', removed: 2, bytes: 2 }])
    expect((await readdir(dir)).sort()).toEqual([M_PLUS_400, M_PLUS_700, NOTO_400].sort())
  })

  it('resolves a FONT_ALIASES short name to the same slug as the real name', async () => {
    await writeFile(join(dir, M_PLUS_400), 'aa')
    await writeFile(join(dir, M_PLUS_400_OLD), 'a')
    await writeFile(join(dir, NOTO_400), 'a')

    const results = await pruneFonts(['mplus'], dir)

    expect(results).toEqual([{ family: 'M PLUS Rounded 1c', removed: 1, bytes: 1 }])
    expect((await readdir(dir)).sort()).toEqual([M_PLUS_400, NOTO_400].sort())
  })

  it('does nothing when every family has one version', async () => {
    await writeFile(join(dir, M_PLUS_400), 'a')
    await writeFile(join(dir, NOTO_400), 'a')

    expect(await pruneFonts(undefined, dir)).toEqual([])
  })

  it('limits itself to the named families', async () => {
    await writeFile(join(dir, M_PLUS_400), 'a')
    await writeFile(join(dir, M_PLUS_400_OLD), 'a')
    await writeFile(join(dir, NOTO_400), 'a')
    const noto400Old = 'Noto-Sans-JP-v52-400-stale.ttf'
    await writeFile(join(dir, noto400Old), 'a')

    const results = await pruneFonts(['M PLUS Rounded 1c'], dir)

    expect(results).toEqual([{ family: 'M PLUS Rounded 1c', removed: 1, bytes: 1 }])
    expect((await readdir(dir)).sort()).toEqual([M_PLUS_400, NOTO_400, noto400Old].sort())
  })

  it('returns nothing for a missing directory', async () => {
    expect(await pruneFonts(undefined, join(dir, 'nope'))).toEqual([])
  })
})

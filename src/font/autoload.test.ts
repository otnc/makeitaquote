import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureDefaultFonts, type FontFetcher, resetAutoloadForTests, useFont } from './autoload'
import { resolveCacheDir } from './diskCache'
import { fileNameFor, resolveGoogleFont } from './googleFonts'

let cacheDir = ''

/** A family nothing on the system provides, so resolution always runs. */
function unusedFamily(): string {
  return `Test Family ${Math.random().toString(36).slice(2)}`
}

/** Stands in for the Google Fonts CSS API. */
function cssFor(family: string, weights = [400]): string {
  return weights
    .map(
      (weight) => `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  src: url(https://fonts.gstatic.com/s/test/v9/hash-${weight}.ttf) format('truetype');
}`,
    )
    .join('\n')
}

function cssResponder(css: string, status = 200) {
  return async () => ({ ok: status < 400, status, text: async () => css })
}

function countingFetcher(bytes = Buffer.from('font-bytes')): FontFetcher & { calls: string[] } {
  const calls: string[] = []
  const fetcher = (async (url: string) => {
    calls.push(url)
    return bytes
  }) as FontFetcher & { calls: string[] }
  fetcher.calls = calls
  return fetcher
}

/**
 * `useFont` resolves through the real CSS API, so tests stub `fetch` at the
 * global level to keep the whole path — including URL building — under test.
 */
function stubGoogleFonts(css: string, status = 200) {
  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input)
    if (!url.includes('fonts.googleapis.com')) throw new Error(`unexpected fetch: ${url}`)
    return new Response(css, { status, headers: { 'content-type': 'text/css' } })
  })
}

beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'miq-font-test-'))
  resetAutoloadForTests()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await rm(cacheDir, { recursive: true, force: true })
})

describe('useFont', () => {
  it('resolves through Google Fonts and downloads the file', async () => {
    const family = unusedFamily()
    stubGoogleFonts(cssFor(family))
    const fetcher = countingFetcher()

    await useFont(family, { cacheDir, fetcher })

    expect(fetcher.calls).toEqual(['https://fonts.gstatic.com/s/test/v9/hash-400.ttf'])
  })

  it('resolves a FONT_ALIASES short name before asking Google Fonts', async () => {
    const requestedUrls: string[] = []
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      requestedUrls.push(input instanceof Request ? input.url : String(input))
      return new Response(cssFor('Hachi Maru Pop'), {
        status: 200,
        headers: { 'content-type': 'text/css' },
      })
    })

    await useFont('pop', { cacheDir, fetcher: countingFetcher() })

    expect(requestedUrls[0]).toContain('Hachi+Maru+Pop')
  })

  it('treats the alias and the real name as the same font once resolved', async () => {
    stubGoogleFonts(cssFor('Hachi Maru Pop'))
    const fetcher = countingFetcher()

    await useFont('pop', { cacheDir, fetcher })
    await useFont('Hachi Maru Pop', { cacheDir, fetcher })

    expect(fetcher.calls).toHaveLength(1)
  })

  it('writes the font into the cache directory', async () => {
    const family = unusedFamily()
    stubGoogleFonts(cssFor(family))

    await useFont(family, { cacheDir, fetcher: countingFetcher() })

    expect(await readdir(cacheDir)).toHaveLength(1)
  })

  it('leaves no partial files behind', async () => {
    const family = unusedFamily()
    stubGoogleFonts(cssFor(family))

    await useFont(family, { cacheDir, fetcher: countingFetcher() })

    const entries = await readdir(cacheDir)
    expect(entries.some((name) => name.endsWith('.part'))).toBe(false)
  })

  it('does not download again when the file is already cached', async () => {
    const family = unusedFamily()
    stubGoogleFonts(cssFor(family))
    const fetcher = countingFetcher()

    await useFont(family, { cacheDir, fetcher })
    resetAutoloadForTests()
    await useFont(family, { cacheDir, fetcher })

    expect(fetcher.calls).toHaveLength(1)
  })

  it('downloads one file per requested weight', async () => {
    const family = unusedFamily()
    stubGoogleFonts(cssFor(family, [400, 700]))
    const fetcher = countingFetcher()

    await useFont(family, { cacheDir, fetcher, weights: [400, 700] })

    expect(fetcher.calls).toHaveLength(2)
  })

  it('never touches the network when online is false', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('should not be called')
    })
    const fetcher = countingFetcher()

    const ok = await useFont(unusedFamily(), { cacheDir, fetcher, online: false })

    expect(ok).toBe(false)
    expect(fetcher.calls).toEqual([])
  })

  it('says how to fix it when offline and the font is missing', async () => {
    await useFont(unusedFamily(), { cacheDir, online: false })

    const message = vi.mocked(console.warn).mock.calls[0]?.[0] as string
    expect(message).toContain('registerFromPath')
  })

  it('warns rather than throwing when Google does not serve the family', async () => {
    stubGoogleFonts('', 400)

    await expect(useFont('Definitely Not A Font', { cacheDir })).resolves.toBe(false)
    expect(console.warn).toHaveBeenCalled()
  })

  it('explains that only Google-served fonts can be fetched by name', async () => {
    stubGoogleFonts('', 400)

    await useFont('Definitely Not A Font', { cacheDir })

    const message = vi.mocked(console.warn).mock.calls[0]?.[0] as string
    expect(message).toContain('not available on Google Fonts')
  })

  it('names the licence problem for a known unavailable font', async () => {
    stubGoogleFonts('', 400)

    await useFont('Jiyu no Tsubasa', { cacheDir })

    const message = vi.mocked(console.warn).mock.calls[0]?.[0] as string
    expect(message).toContain('licence is unclear')
  })

  it('suggests a correction for a near miss', async () => {
    stubGoogleFonts('', 400)

    await useFont('Dacing Script', { cacheDir })

    const message = vi.mocked(console.warn).mock.calls[0]?.[0] as string
    expect(message).toContain('Dancing Script')
  })

  it('warns instead of throwing when the download fails', async () => {
    const family = unusedFamily()
    stubGoogleFonts(cssFor(family))
    const fetcher: FontFetcher = async () => {
      throw new Error('network is down')
    }

    await expect(useFont(family, { cacheDir, fetcher })).resolves.toBe(false)

    const message = vi.mocked(console.warn).mock.calls[0]?.[0] as string
    expect(message).toContain('network is down')
  })

  it('announces the download once', async () => {
    const family = unusedFamily()
    stubGoogleFonts(cssFor(family))

    await useFont(family, { cacheDir, fetcher: countingFetcher() })

    const message = vi.mocked(console.info).mock.calls[0]?.[0] as string
    expect(message).toContain('happens once')
  })

  it('reports progress when asked', async () => {
    const family = unusedFamily()
    stubGoogleFonts(cssFor(family))
    const onProgress = vi.fn()

    await useFont(family, { cacheDir, fetcher: countingFetcher(Buffer.alloc(4096)), onProgress })

    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ received: 4096 }))
  })
})

describe('ensureDefaultFonts', () => {
  it('does nothing when downloading is off', async () => {
    const fetcher = countingFetcher()

    await ensureDefaultFonts({ cacheDir, fetcher, online: false })

    expect(fetcher.calls).toEqual([])
  })

  it('fetches each configured family', async () => {
    // Each family has to resolve to its own file, or the second one correctly
    // hits the cache written by the first.
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input)
      const requested = new URL(url).searchParams.get('family') ?? 'x'
      const slug = requested.replaceAll('+', '-')
      return new Response(
        `@font-face {
  font-family: '${requested}';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/${slug}/v1/hash.ttf) format('truetype');
}`,
        { status: 200, headers: { 'content-type': 'text/css' } },
      )
    })
    const fetcher = countingFetcher()

    await ensureDefaultFonts({
      cacheDir,
      fetcher,
      families: [unusedFamily(), unusedFamily()],
    })

    expect(fetcher.calls).toHaveLength(2)
  })
})

describe('resolveGoogleFont', () => {
  it('asks for the bare family when only regular is wanted', async () => {
    let requested = ''
    await resolveGoogleFont('Dela Gothic One', {
      fetchCss: async (url) => {
        requested = url
        return { ok: true, status: 200, text: async () => cssFor('Dela Gothic One') }
      },
    })

    expect(requested).toBe('https://fonts.googleapis.com/css2?family=Dela+Gothic+One')
  })

  it('asks for specific weights when several are wanted', async () => {
    let requested = ''
    await resolveGoogleFont('Noto Sans JP', {
      weights: [700, 400],
      fetchCss: async (url) => {
        requested = url
        return { ok: true, status: 200, text: async () => cssFor('Noto Sans JP', [400, 700]) }
      },
    })

    expect(requested).toBe('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700')
  })

  it('reads the weight and style off each face', async () => {
    const faces = await resolveGoogleFont('Test', {
      weights: [400, 700],
      fetchCss: cssResponder(cssFor('Test', [400, 700])),
    })

    expect(faces.map((face) => face.weight)).toEqual([400, 700])
    expect(faces.every((face) => face.style === 'normal')).toBe(true)
  })

  it('drops duplicate urls from subset blocks', async () => {
    const duplicated = `${cssFor('Test')}\n${cssFor('Test')}`
    const faces = await resolveGoogleFont('Test', { fetchCss: cssResponder(duplicated) })

    expect(faces).toHaveLength(1)
  })

  it('throws when Google has no such family', async () => {
    await expect(resolveGoogleFont('Nope', { fetchCss: cssResponder('', 400) })).rejects.toThrow(
      /not available on Google Fonts/,
    )
  })

  it('throws when the css has no font file', async () => {
    await expect(
      resolveGoogleFont('Nope', { fetchCss: cssResponder('@font-face { }') }),
    ).rejects.toThrow(/no usable font file/)
  })
})

describe('fileNameFor', () => {
  it('includes the family, version and weight', () => {
    const name = fileNameFor({
      family: 'Dela Gothic One',
      weight: 700,
      style: 'normal',
      url: 'https://fonts.gstatic.com/s/delagothicone/v19/abc123.ttf',
    })

    expect(name).toContain('Dela-Gothic-One')
    expect(name).toContain('v19')
    expect(name).toContain('700')
    expect(name.endsWith('.ttf')).toBe(true)
  })

  it('changes when Google publishes a new version', () => {
    const face = { family: 'X', weight: 400, style: 'normal' as const }
    const v1 = fileNameFor({ ...face, url: 'https://fonts.gstatic.com/s/x/v1/a.ttf' })
    const v2 = fileNameFor({ ...face, url: 'https://fonts.gstatic.com/s/x/v2/a.ttf' })

    expect(v1).not.toBe(v2)
  })

  it('marks italic faces', () => {
    const name = fileNameFor({
      family: 'X',
      weight: 400,
      style: 'italic',
      url: 'https://fonts.gstatic.com/s/x/v1/a.ttf',
    })

    expect(name).toContain('italic')
  })
})

describe('resolveCacheDir', () => {
  it('prefers an explicit directory', () => {
    expect(resolveCacheDir('/somewhere')).toBe('/somewhere')
  })

  it('falls back to an env var', () => {
    vi.stubEnv('MIQ_FONT_CACHE_DIR', '/from-env')

    expect(resolveCacheDir()).toBe('/from-env')

    vi.unstubAllEnvs()
  })

  it('returns a makeitaquote-scoped path by default', () => {
    vi.stubEnv('MIQ_FONT_CACHE_DIR', '')

    expect(resolveCacheDir()).toContain('makeitaquote')

    vi.unstubAllEnvs()
  })
})

describe('cached fonts on disk', () => {
  it('are registered without any network access', async () => {
    const family = unusedFamily()
    stubGoogleFonts(cssFor(family))
    await useFont(family, { cacheDir, fetcher: countingFetcher() })

    const files = await readdir(cacheDir)
    expect(files).toHaveLength(1)

    // A pre-populated cache is what makes fully offline operation possible.
    await writeFile(join(cacheDir, files[0] as string), 'font-bytes')
    resetAutoloadForTests()

    const fetcher = countingFetcher()
    await useFont(family, { cacheDir, fetcher })
    expect(fetcher.calls).toEqual([])
  })
})

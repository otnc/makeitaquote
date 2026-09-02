import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cachedFontPath, resolveCacheDir, writeCachedFont } from './diskCache'

/**
 * `open()`'s handle normally passes straight through to the real one; a test
 * flips `failNextWrite` to make the next handle's `write()` reject, so
 * `writeCachedFont()`'s failure-cleanup path can be exercised without
 * actually running the disk out of space.
 */
let failNextWrite = false

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const handle = await actual.open(...args)
      if (failNextWrite) {
        failNextWrite = false
        handle.write = async () => {
          throw new Error('disk full')
        }
      }
      return handle
    },
  }
})

let dir = ''

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  failNextWrite = false
  if (dir) await rm(dir, { recursive: true, force: true })
  dir = ''
})

describe('resolveCacheDir', () => {
  it('prefers an explicit override', () => {
    expect(resolveCacheDir('/somewhere')).toBe('/somewhere')
  })

  it('reads MIQ_FONT_CACHE_DIR', () => {
    vi.stubEnv('MIQ_FONT_CACHE_DIR', '/from-env')

    expect(resolveCacheDir()).toBe('/from-env')
  })

  it('defaults to .makeitaquote/fonts under the nearest package.json', async () => {
    dir = await mkdtemp(join(tmpdir(), 'miq-cache-root-'))
    await writeFile(join(dir, 'package.json'), '{}')
    vi.spyOn(process, 'cwd').mockReturnValue(dir)

    expect(resolveCacheDir()).toBe(join(dir, '.makeitaquote', 'fonts'))
  })

  it('walks up to find the project root from a nested directory', async () => {
    dir = await mkdtemp(join(tmpdir(), 'miq-cache-root-nested-'))
    await writeFile(join(dir, 'package.json'), '{}')
    const nested = join(dir, 'src', 'deep')
    await mkdir(nested, { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(nested)

    expect(resolveCacheDir()).toBe(join(dir, '.makeitaquote', 'fonts'))
  })
})

describe('writeCachedFont', () => {
  it('writes the file and leaves no temp file behind', async () => {
    dir = await mkdtemp(join(tmpdir(), 'miq-write-cache-'))

    const target = await writeCachedFont(dir, 'family-v1-400-abc.ttf', Buffer.from('font-bytes'))

    expect(target).toBe(cachedFontPath(dir, 'family-v1-400-abc.ttf'))
    expect(await readdir(dir)).toEqual(['family-v1-400-abc.ttf'])
  })

  it('cleans up the temp file when the write fails, instead of leaking it', async () => {
    dir = await mkdtemp(join(tmpdir(), 'miq-write-cache-fail-'))
    failNextWrite = true

    await expect(
      writeCachedFont(dir, 'family-v1-400-abc.ttf', Buffer.from('font-bytes')),
    ).rejects.toThrow('disk full')

    expect(await readdir(dir)).toEqual([])
  })
})

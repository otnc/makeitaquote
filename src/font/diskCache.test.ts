import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveCacheDir } from './diskCache'

let dir = ''

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
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

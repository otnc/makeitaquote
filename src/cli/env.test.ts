import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkEnv } from './env'

let dir = ''

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  if (dir) await rm(dir, { recursive: true, force: true })
  dir = ''
})

describe('checkEnv', () => {
  it('reports the resolved storage paths and env var overrides', async () => {
    dir = await mkdtemp(join(tmpdir(), 'miq-env-test-'))
    await writeFile(join(dir, 'package.json'), '{}')
    vi.spyOn(process, 'cwd').mockReturnValue(dir)
    vi.stubGlobal('fetch', async () => new Response('', { status: 200 }))

    const report = await checkEnv()

    expect(report.storage.projectRoot).toBe(dir)
    expect(report.storage.fontsDir).toBe(join(dir, '.makeitaquote', 'fonts'))
    expect(report.storage.twemojiDir).toBe(join(dir, '.makeitaquote', 'twemoji'))
    expect(report.storage.fontCacheDirEnv).toBeNull()
    expect(report.network.every((entry) => entry.reachable)).toBe(true)
  })

  it('reports MIQ_FONT_CACHE_DIR/MIQ_TWEMOJI_CACHE_DIR when set', async () => {
    vi.stubEnv('MIQ_FONT_CACHE_DIR', '/from-env/fonts')
    vi.stubEnv('MIQ_TWEMOJI_CACHE_DIR', '/from-env/twemoji')
    vi.stubGlobal('fetch', async () => new Response('', { status: 200 }))

    const report = await checkEnv()

    expect(report.storage.fontsDir).toBe('/from-env/fonts')
    expect(report.storage.twemojiDir).toBe('/from-env/twemoji')
    expect(report.storage.fontCacheDirEnv).toBe('/from-env/fonts')
    expect(report.storage.twemojiCacheDirEnv).toBe('/from-env/twemoji')
  })

  it('reports a host as unreachable when the request fails', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('network down')
    })

    const report = await checkEnv()

    expect(report.network.every((entry) => !entry.reachable)).toBe(true)
  })

  it('reports a directory writable when it already exists', async () => {
    dir = await mkdtemp(join(tmpdir(), 'miq-env-writable-'))
    vi.stubEnv('MIQ_FONT_CACHE_DIR', dir)
    vi.stubEnv('MIQ_TWEMOJI_CACHE_DIR', join(dir, 'not-yet-created'))
    vi.stubGlobal('fetch', async () => new Response('', { status: 200 }))

    const report = await checkEnv()

    expect(report.storage.fontsWritable).toBe(true)
    expect(report.storage.twemojiWritable).toBe(true)
  })
})

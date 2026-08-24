import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TwemojiInfo, TwemojiInstallResult } from '../emoji/twemojiStore'
import type { FontInstallResult, InstalledFont } from '../font/install'
import { DEFAULT_FONT_FAMILIES } from '../font/sources'
import type { FontUpdateStatus } from '../font/updates'
import { type CliIo, run } from './index'
import { currentVersion } from './packageVersion'
import type { PackageUpdateStatus } from './updateCheck'

const VERSION = currentVersion()

function io(): CliIo & { lines: string[] } {
  const lines: string[] = []
  return { lines, line: (text) => lines.push(text) }
}

/** Every dep as a spy, so each test asserts exactly what ran. */
function deps() {
  return {
    installTwemoji: vi.fn(
      async (_options?: {
        onProgress?: (done: number, total: number) => void
      }): Promise<TwemojiInstallResult> => ({
        dir: '/cache/twemoji',
        version: '17.0.3',
        total: 3,
        downloaded: 3,
        skipped: 0,
      }),
    ),
    uninstallTwemoji: vi.fn(async (): Promise<void> => {}),
    twemojiInfo: vi.fn(
      async (): Promise<TwemojiInfo> => ({
        dir: '/cache/twemoji',
        images: 3,
        bytes: 3072,
        version: '17.0.3',
      }),
    ),
    installFonts: vi.fn(
      async (families: readonly string[]): Promise<FontInstallResult[]> =>
        families.map((family) => ({ family, ok: true })),
    ),
    uninstallFonts: vi.fn(async (_families?: readonly string[]): Promise<number> => 2),
    listInstalledFonts: vi.fn((): InstalledFont[] => [
      {
        family: 'M PLUS Rounded 1c',
        files: 2,
        bytes: 1_048_576,
        weights: [400, 700],
        italic: false,
        version: 'v15',
      },
    ]),
    checkFontUpdates: vi.fn(
      async (installed: readonly InstalledFont[]): Promise<FontUpdateStatus[]> =>
        installed.map((font) => ({
          family: font.family,
          installedVersion: font.version,
          latestVersion: font.version,
          outdated: false,
        })),
    ),
    checkPackageUpdate: vi.fn(
      async (current: string): Promise<PackageUpdateStatus> => ({ current, latest: current }),
    ),
    latestTwemojiVersion: vi.fn(async (): Promise<string | null> => '17.0.3'),
  }
}

/**
 * `--help`/`-h`/`--version` are handled entirely inside cleye: it writes to
 * `console.log` and calls `process.exit()` directly, with no seam to route
 * either through `io`. That's fine for the real CLI — a real invocation
 * should print and exit — so these three are verified by spying on the
 * console/process globals rather than through `io`, and only for their
 * side effects (something was printed, the right exit code was requested),
 * not cleye's own rendered text — that's cleye's tested behaviour, not this
 * package's.
 */
function mockExit() {
  return vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('run', () => {
  it('prints help with no arguments', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const spy = io()

    await expect(run([], deps(), spy)).resolves.toBe(0)

    expect(log).toHaveBeenCalled()
  })

  it('prints help for the help command, without going through io', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const spy = io()

    await expect(run(['help'], deps(), spy)).resolves.toBe(0)

    expect(log).toHaveBeenCalled()
    expect(spy.lines).toEqual([])
  })

  it('prints help and exits 0 for --help and -h', async () => {
    for (const command of ['--help', '-h']) {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const exit = mockExit()
      const spy = io()

      await run([command], deps(), spy)

      expect(log).toHaveBeenCalled()
      expect(exit).toHaveBeenCalledWith(0)
      vi.restoreAllMocks()
    }
  })

  it('rejects an unknown command', async () => {
    const spy = io()

    await expect(run(['explode'], deps(), spy)).resolves.toBe(1)

    expect(spy.lines[0]).toContain('Unknown command: explode')
  })

  it('accepts ls and list as the same command', async () => {
    for (const command of ['ls', 'list']) {
      const spy = io()
      await run([command], deps(), spy)
      expect(spy.lines.join('\n')).toContain('Twemoji 17.0.3')
    }
  })
})

describe('install', () => {
  it('installs everything with no target', async () => {
    const d = deps()

    await run(['install'], d, io())

    expect(d.installTwemoji).toHaveBeenCalledTimes(1)
    expect(d.installFonts).toHaveBeenCalledWith(DEFAULT_FONT_FAMILIES)
  })

  it('installs only twemoji for the twemoji target', async () => {
    const d = deps()

    await run(['install', 'twemoji'], d, io())

    expect(d.installTwemoji).toHaveBeenCalledTimes(1)
    expect(d.installFonts).not.toHaveBeenCalled()
  })

  it('installs only the default fonts for the fonts target', async () => {
    const d = deps()

    await run(['install', 'fonts'], d, io())

    expect(d.installTwemoji).not.toHaveBeenCalled()
    expect(d.installFonts).toHaveBeenCalledWith(DEFAULT_FONT_FAMILIES)
  })

  it('installs named families after the fonts keyword', async () => {
    const d = deps()

    await run(['install', 'fonts', 'Dela Gothic One'], d, io())

    expect(d.installTwemoji).not.toHaveBeenCalled()
    expect(d.installFonts).toHaveBeenCalledWith(['Dela Gothic One'])
  })

  it('treats a bare word as a family name', async () => {
    const d = deps()

    await run(['install', 'Dela Gothic One'], d, io())

    expect(d.installFonts).toHaveBeenCalledWith(['Dela Gothic One'])
  })

  it('combines targets', async () => {
    const d = deps()

    await run(['install', 'twemoji', 'Dela Gothic One'], d, io())

    expect(d.installTwemoji).toHaveBeenCalledTimes(1)
    expect(d.installFonts).toHaveBeenCalledWith(['Dela Gothic One'])
  })

  it('fails when a family cannot be installed', async () => {
    const d = deps()
    d.installFonts = vi.fn(
      async (families: readonly string[]): Promise<FontInstallResult[]> =>
        families.map((family) => ({ family, ok: false })),
    )

    const spy = io()
    await expect(run(['install', 'Nope'], d, spy)).resolves.toBe(1)

    expect(spy.lines.join('\n')).toContain('✗ Nope')
  })

  it('fails when twemoji cannot be listed', async () => {
    const d = deps()
    d.installTwemoji = vi.fn(async (): Promise<TwemojiInstallResult> => {
      throw new Error('network is down')
    })

    const spy = io()
    await expect(run(['install', 'twemoji'], d, spy)).resolves.toBe(1)

    expect(spy.lines.join('\n')).toContain('network is down')
  })

  it('reports progress through the io seam', async () => {
    const d = deps()
    d.installTwemoji = vi.fn(
      async (options?: {
        onProgress?: (done: number, total: number) => void
      }): Promise<TwemojiInstallResult> => {
        options?.onProgress?.(1, 3)
        options?.onProgress?.(3, 3)
        return { dir: '/cache/twemoji', version: '17.0.3', total: 3, downloaded: 3, skipped: 0 }
      },
    )
    const lines: string[] = []
    const progress = vi.fn()
    const spy: CliIo = { line: (text) => lines.push(text), progress }

    await run(['install', 'twemoji'], d, spy)

    expect(progress).toHaveBeenLastCalledWith(expect.stringContaining('3/3'))
  })
})

describe('uninstall', () => {
  it('removes everything with no target', async () => {
    const d = deps()

    await run(['uninstall'], d, io())

    expect(d.uninstallTwemoji).toHaveBeenCalledTimes(1)
    expect(d.uninstallFonts).toHaveBeenCalledWith(undefined)
  })

  it('removes only twemoji for the twemoji target', async () => {
    const d = deps()

    await run(['uninstall', 'twemoji'], d, io())

    expect(d.uninstallTwemoji).toHaveBeenCalledTimes(1)
    expect(d.uninstallFonts).not.toHaveBeenCalled()
  })

  it('removes all fonts for the fonts target', async () => {
    const d = deps()

    await run(['uninstall', 'fonts'], d, io())

    expect(d.uninstallTwemoji).not.toHaveBeenCalled()
    expect(d.uninstallFonts).toHaveBeenCalledWith(undefined)
  })

  it('removes only the named family', async () => {
    const d = deps()

    await run(['uninstall', 'fonts', 'Dela Gothic One'], d, io())

    expect(d.uninstallTwemoji).not.toHaveBeenCalled()
    expect(d.uninstallFonts).toHaveBeenCalledWith(['Dela Gothic One'])
  })
})

describe('ls', () => {
  it('describes what is installed', async () => {
    const spy = io()

    await run(['ls'], deps(), spy)

    const out = spy.lines.join('\n')
    expect(out).toContain('Twemoji 17.0.3 — 3 images')
    expect(out).toContain('Fonts — 1 family')
    expect(out).toContain('M PLUS Rounded 1c')
    expect(out).toContain('400, 700')
  })

  it('suggests installing when nothing is on disk', async () => {
    const d = deps()
    d.twemojiInfo = vi.fn(async () => ({
      dir: '/cache/twemoji',
      images: 0,
      bytes: 0,
      version: null,
    }))
    d.listInstalledFonts = vi.fn(() => [])
    const spy = io()

    await run(['ls'], d, spy)

    expect(spy.lines[0]).toContain('Nothing installed yet')
  })
})

describe('aliases', () => {
  it('accepts add and i for install', async () => {
    for (const command of ['add', 'i']) {
      const d = deps()
      await run([command, 'twemoji'], d, io())
      expect(d.installTwemoji).toHaveBeenCalledTimes(1)
    }
  })

  it('accepts remove, rm and un for uninstall', async () => {
    for (const command of ['remove', 'rm', 'un']) {
      const d = deps()
      await run([command, 'twemoji'], d, io())
      expect(d.uninstallTwemoji).toHaveBeenCalledTimes(1)
    }
  })

  it('accepts find and s for search', async () => {
    for (const command of ['find', 's']) {
      const spy = io()
      await run([command], deps(), spy)
      expect(spy.lines[0]).toContain('Fonts miq knows by name')
    }
  })
})

describe('search', () => {
  it('lists the catalogue with no query', async () => {
    const spy = io()

    await expect(run(['search'], deps(), spy)).resolves.toBe(0)

    const out = spy.lines.join('\n')
    expect(out).toContain('Noto Sans JP')
    expect(out).toContain('twemoji')
  })

  it('filters by a case-insensitive substring', async () => {
    const spy = io()

    await run(['search', 'gothic'], deps(), spy)

    const out = spy.lines.join('\n')
    expect(out).toContain('Dela Gothic One')
    expect(out).not.toContain('Noto Sans JP')
  })

  it('suggests a catalogued name for a near miss', async () => {
    const spy = io()

    await run(['search', 'Noto Sans JP Regular'], deps(), spy)

    const out = spy.lines.join('\n')
    expect(out).toContain('No catalogued font matches')
    expect(out).toContain('Did you mean "Noto Sans JP"?')
  })
})

describe('outdated', () => {
  it('reports up to date when nothing has a newer version', async () => {
    const spy = io()

    await expect(run(['outdated'], deps(), spy)).resolves.toBe(0)

    const out = spy.lines.join('\n')
    expect(out).toContain(`✓ makeitaquote ${VERSION} — up to date`)
    expect(out).toContain('✓ Twemoji 17.0.3 — up to date')
    expect(out).toContain('✓ M PLUS Rounded 1c — up to date')
    expect(out).toContain('Everything checked is up to date')
  })

  it('flags a newer package version and exits 1', async () => {
    const d = deps()
    d.checkPackageUpdate = vi.fn(async (current: string) => ({ current, latest: '99.0.0' }))
    const spy = io()

    await expect(run(['outdated'], d, spy)).resolves.toBe(1)

    expect(spy.lines.join('\n')).toContain(`makeitaquote ${VERSION} → 99.0.0`)
  })

  it('flags a newer twemoji release', async () => {
    const d = deps()
    d.latestTwemojiVersion = vi.fn(async () => '99.0.0')
    const spy = io()

    await expect(run(['outdated'], d, spy)).resolves.toBe(1)

    expect(spy.lines.join('\n')).toContain('Twemoji 17.0.3 → 99.0.0')
  })

  it('flags an outdated font', async () => {
    const d = deps()
    d.checkFontUpdates = vi.fn(async (installed) =>
      installed.map((font) => ({
        family: font.family,
        installedVersion: font.version,
        latestVersion: 'v99',
        outdated: true,
      })),
    )
    const spy = io()

    await expect(run(['outdated'], d, spy)).resolves.toBe(1)

    expect(spy.lines.join('\n')).toContain('M PLUS Rounded 1c v15 → v99')
  })

  it('reports a check that could not reach the network', async () => {
    const d = deps()
    d.checkPackageUpdate = vi.fn(async (current: string) => ({ current, latest: null }))
    const spy = io()

    await expect(run(['outdated'], d, spy)).resolves.toBe(0)

    expect(spy.lines.join('\n')).toContain('could not reach the npm registry')
  })
})

describe('--version', () => {
  it('prints the package version and exits 0', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = mockExit()
    const spy = io()

    await run(['--version'], deps(), spy)

    expect(log).toHaveBeenCalledWith(VERSION)
    expect(exit).toHaveBeenCalledWith(0)
  })
})

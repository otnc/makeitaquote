import {
  installTwemoji,
  latestTwemojiVersion,
  type TwemojiInfo,
  type TwemojiInstallResult,
  twemojiInfo,
  uninstallTwemoji,
} from '../emoji/twemojiStore'
import { FONT_CATALOGUE, suggestionFor } from '../font/catalogue'
import { resolveCacheDir } from '../font/diskCache'
import {
  type FontInstallResult,
  type InstalledFont,
  installFonts,
  listInstalledFonts,
  uninstallFonts,
} from '../font/install'
import { DEFAULT_FONT_FAMILIES } from '../font/sources'
import { checkFontUpdates } from '../font/updates'
import { isNewerVersion } from '../util/version'
import { currentVersion } from './packageVersion'
import { checkPackageUpdate, type PackageUpdateStatus } from './updateCheck'

/**
 * Everything the commands do, injectable so tests need no disk or network.
 *
 * These functions are the entire testable surface of the CLI: argv parsing,
 * aliases and `--help`/`--version` are cleye's job (see `index.ts`), and
 * aren't re-tested here — only what each command actually does once cleye
 * has already worked out which one was asked for.
 */
export interface CliDeps {
  installTwemoji?: (options?: {
    onProgress?: (done: number, total: number) => void
  }) => Promise<TwemojiInstallResult>
  uninstallTwemoji?: () => Promise<void>
  twemojiInfo?: () => Promise<TwemojiInfo>
  latestTwemojiVersion?: () => Promise<string | null>
  installFonts?: (families: readonly string[]) => Promise<FontInstallResult[]>
  uninstallFonts?: (families?: readonly string[]) => Promise<number>
  listInstalledFonts?: () => InstalledFont[]
  checkFontUpdates?: typeof checkFontUpdates
  checkPackageUpdate?: (current: string) => Promise<PackageUpdateStatus>
}

export interface CliIo {
  /** A finished line of output. */
  line(text: string): void
  /** In-place progress, when the output supports it. */
  progress?: (text: string) => void
}

export const defaultIo: CliIo = {
  line: (text) => console.log(text),
}

/** What a command line's targets add up to. */
interface Targets {
  twemoji: boolean
  families: string[]
  /** The `fonts` keyword with no family names after it. */
  defaultFonts: boolean
}

/**
 * Reads target words off a command line.
 *
 * `twemoji`/`emoji` and `fonts`/`font` are keywords; everything else is a
 * family name, so `miq install fonts "Dela Gothic One"` installs one family
 * and `miq install "Dela Gothic One"` does exactly the same.
 */
export function parseTargets(args: readonly string[]): Targets {
  const targets: Targets = { twemoji: false, families: [], defaultFonts: false }
  let sawFontsKeyword = false

  for (const arg of args) {
    if (arg === 'twemoji' || arg === 'emoji') targets.twemoji = true
    else if (arg === 'fonts' || arg === 'font') sawFontsKeyword = true
    else targets.families.push(arg)
  }

  targets.defaultFonts = sawFontsKeyword && targets.families.length === 0
  return targets
}

export async function installCommand(
  args: readonly string[],
  deps: CliDeps,
  io: CliIo,
): Promise<number> {
  const targets = parseTargets(args)
  const everything = args.length === 0
  let failed = false

  if (everything || targets.twemoji) {
    const ok = await installTwemojiStep(deps, io)
    failed ||= !ok
  }

  const families = everything || targets.defaultFonts ? DEFAULT_FONT_FAMILIES : targets.families
  if (families.length > 0) {
    const ok = await installFontsStep(families, deps, io)
    failed ||= !ok
  }

  return failed ? 1 : 0
}

export async function uninstallCommand(
  args: readonly string[],
  deps: CliDeps,
  io: CliIo,
): Promise<number> {
  const targets = parseTargets(args)
  const everything = args.length === 0

  if (everything || targets.twemoji) {
    const info = await (deps.twemojiInfo ?? twemojiInfo)()
    await (deps.uninstallTwemoji ?? uninstallTwemoji)()
    io.line(
      info.images > 0 ? `Removed Twemoji (${info.images} images)` : 'Twemoji was not installed',
    )
  }

  if (everything || targets.defaultFonts || targets.families.length > 0) {
    const families = everything || targets.defaultFonts ? undefined : targets.families
    const removed = await (deps.uninstallFonts ?? uninstallFonts)(families)
    io.line(
      removed > 0
        ? `Removed ${removed} font file${removed === 1 ? '' : 's'}`
        : 'No fonts to remove',
    )
  }

  return 0
}

export async function listCommand(deps: CliDeps, io: CliIo): Promise<number> {
  const twemoji = await (deps.twemojiInfo ?? twemojiInfo)()
  const fonts = (deps.listInstalledFonts ?? listInstalledFonts)()

  if (twemoji.images === 0 && fonts.length === 0) {
    io.line('Nothing installed yet.')
    io.line('')
    io.line('  miq install            Twemoji and the default fonts')
    io.line('  miq install twemoji    just Twemoji')
    io.line('  miq install fonts      just the default fonts')
    return 0
  }

  if (twemoji.images > 0) {
    const version = twemoji.version ? ` ${twemoji.version}` : ''
    io.line(`Twemoji${version} — ${twemoji.images} images, ${formatBytes(twemoji.bytes)}`)
    io.line(`  ${twemoji.dir}`)
    io.line('')
  }

  if (fonts.length > 0) {
    const bytes = fonts.reduce((sum, font) => sum + font.bytes, 0)
    io.line(
      `Fonts — ${fonts.length} famil${fonts.length === 1 ? 'y' : 'ies'}, ${formatBytes(bytes)}`,
    )
    io.line(`  ${resolveCacheDir()}`)
    for (const font of fonts) {
      const weights = font.weights.join(', ')
      const style = font.italic ? `${weights}, italic` : weights
      io.line(`  ${font.family.padEnd(28)} ${style.padEnd(12)} ${formatBytes(font.bytes)}`)
    }
  }

  return 0
}

/** Lists fonts miq knows how to install by name — the catalogue, not the full Google Fonts library. */
export function searchCommand(query: string | undefined, io: CliIo): number {
  const trimmed = query?.trim()
  const matches = trimmed
    ? FONT_CATALOGUE.filter((family) => family.toLowerCase().includes(trimmed.toLowerCase()))
    : FONT_CATALOGUE

  if (matches.length > 0) {
    io.line(trimmed ? `Fonts miq knows by name matching "${trimmed}":` : 'Fonts miq knows by name:')
    for (const family of matches) io.line(`  ${family}`)
  } else {
    io.line(`No catalogued font matches "${trimmed}".`)
    const suggestion = trimmed ? suggestionFor(trimmed) : undefined
    if (suggestion) io.line(`Did you mean "${suggestion}"?`)
  }

  io.line('')
  io.line('This list is a convenience, not a limit — any Google Fonts family name works:')
  io.line('  miq install "<family name>"')
  io.line('')
  io.line('Other installable targets:')
  io.line('  twemoji   Every Twemoji image (~4000 files, ~4 MB)')

  return 0
}

export async function outdatedCommand(deps: CliDeps, io: CliIo): Promise<number> {
  const packageStatus = await (deps.checkPackageUpdate ?? checkPackageUpdate)(currentVersion())
  const twemoji = await (deps.twemojiInfo ?? twemojiInfo)()
  const fonts = (deps.listInstalledFonts ?? listInstalledFonts)()

  let outdated = reportPackageUpdate(packageStatus, io)
  outdated = (await reportTwemojiUpdate(twemoji, deps, io)) || outdated

  if (fonts.length > 0) {
    io.line('Fonts')
    outdated = (await reportFontUpdates(fonts, deps, io)) || outdated
  }

  if (!outdated) {
    io.line('')
    io.line('Everything checked is up to date.')
  }

  return outdated ? 1 : 0
}

function reportPackageUpdate(status: PackageUpdateStatus, io: CliIo): boolean {
  if (status.latest === null) {
    io.line(`  ? makeitaquote ${status.current} — could not reach the npm registry`)
    return false
  }
  if (isNewerVersion(status.current, status.latest)) {
    io.line(
      `  ↑ makeitaquote ${status.current} → ${status.latest} — npm install -g makeitaquote@latest`,
    )
    return true
  }
  io.line(`  ✓ makeitaquote ${status.current} — up to date`)
  return false
}

async function reportTwemojiUpdate(info: TwemojiInfo, deps: CliDeps, io: CliIo): Promise<boolean> {
  if (info.version === null) {
    io.line('  · Twemoji — not installed')
    return false
  }

  const latest = await (deps.latestTwemojiVersion ?? latestTwemojiVersion)()
  if (latest === null) {
    io.line(`  ? Twemoji ${info.version} — could not reach jsDelivr`)
    return false
  }
  if (isNewerVersion(info.version, latest)) {
    io.line(`  ↑ Twemoji ${info.version} → ${latest} — miq install twemoji`)
    return true
  }
  io.line(`  ✓ Twemoji ${info.version} — up to date`)
  return false
}

async function reportFontUpdates(
  fonts: readonly InstalledFont[],
  deps: CliDeps,
  io: CliIo,
): Promise<boolean> {
  const statuses = await (deps.checkFontUpdates ?? checkFontUpdates)(fonts)
  let outdated = false

  for (const status of statuses) {
    if (status.latestVersion === null) {
      io.line(`  ? ${status.family} — could not check`)
    } else if (status.outdated) {
      outdated = true
      io.line(
        `  ↑ ${status.family} ${status.installedVersion} → ${status.latestVersion} — ` +
          `miq install fonts "${status.family}"`,
      )
    } else {
      io.line(`  ✓ ${status.family} — up to date`)
    }
  }

  return outdated
}

async function installTwemojiStep(deps: CliDeps, io: CliIo): Promise<boolean> {
  io.line('Twemoji')
  let progressed = false
  try {
    const result = await (deps.installTwemoji ?? installTwemoji)({
      onProgress: (done, total) => {
        progressed = true
        io.progress?.(`${bar(done, total)} ${done}/${total}`)
      },
    })
    if (progressed) io.line('')

    const summary =
      result.downloaded === 0
        ? `already installed (${result.total} images)`
        : result.skipped === 0
          ? `installed ${result.downloaded} images`
          : `installed ${result.downloaded}, ${result.skipped} already present`
    io.line(`  ✓ Twemoji ${result.version} — ${summary}`)
    return true
  } catch (cause) {
    if (progressed) io.line('')
    io.line(`  ✗ Twemoji — ${cause instanceof Error ? cause.message : String(cause)}`)
    return false
  }
}

async function installFontsStep(
  families: readonly string[],
  deps: CliDeps,
  io: CliIo,
): Promise<boolean> {
  io.line('Fonts')
  const results = await (deps.installFonts ?? installFonts)(families)

  let ok = true
  for (const result of results) {
    if (result.ok) io.line(`  ✓ ${result.family}`)
    else {
      io.line(`  ✗ ${result.family} — not available (see the warning above)`)
      ok = false
    }
  }
  return ok
}

/** A progress bar that fits whatever width it is given. */
function bar(done: number, total: number, width = 24): string {
  const filled = total > 0 ? Math.round((done / total) * width) : width
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`
}

/** `4.1 MB`, `870 KB`, `512 B` — one decimal below ten, none above. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}

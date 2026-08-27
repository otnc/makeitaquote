import { writeFile } from 'node:fs/promises'
import {
  installTwemoji,
  latestTwemojiVersion,
  type TwemojiInfo,
  type TwemojiInstallResult,
  twemojiInfo,
  uninstallTwemoji,
} from '../emoji/twemojiStore'
import { FONT_CATALOGUE, resolveFontAlias, suggestionFor } from '../font/catalogue'
import { resolveCacheDir } from '../font/diskCache'
import {
  type FontInstallResult,
  type InstalledFont,
  installFonts,
  listInstalledFonts,
  type PruneResult,
  pruneFonts,
  uninstallFonts,
} from '../font/install'
import { DEFAULT_FONT_FAMILIES } from '../font/sources'
import { checkFontUpdates, type FontUpdateStatus } from '../font/updates'
import { isNewerVersion } from '../util/version'
import { checkEnv, type EnvReport } from './env'
import { currentVersion } from './packageVersion'
import { type RenderInput, renderToBuffer, resolveAvatar } from './render'
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
  pruneFonts?: (families?: readonly string[]) => Promise<PruneResult[]>
  checkFontUpdates?: typeof checkFontUpdates
  checkPackageUpdate?: (current: string) => Promise<PackageUpdateStatus>
  checkEnv?: () => Promise<EnvReport>
  render?: (input: RenderInput) => Promise<Buffer>
  resolveAvatar?: (value: string) => ReturnType<typeof resolveAvatar>
  writeFile?: (path: string, bytes: Buffer) => Promise<void>
}

export interface CliIo {
  /** A finished line of output. */
  line(text: string): void
  /** In-place progress, when the output supports it. */
  progress?: (text: string) => void
}

/** Shared by every read-only reporting command (`ls`, `search`, `outdated`, `env`). */
export interface OutputOptions {
  /** Print machine-readable JSON instead of the human-readable report. */
  json?: boolean
}

export const defaultIo: CliIo = {
  line: (text) => console.log(text),
}

/** What a command line's targets add up to. */
interface Targets {
  /** The `all` keyword — the same as passing no target at all. */
  all: boolean
  twemoji: boolean
  families: string[]
  /** The `fonts` keyword with no family names after it. */
  defaultFonts: boolean
}

/**
 * Reads target words off a command line.
 *
 * `all`, `twemoji`/`emoji` and `fonts`/`font` are keywords; everything else
 * is a family name, so `miq install fonts "Dela Gothic One"` installs one
 * family and `miq install "Dela Gothic One"` does exactly the same. `all`
 * means the same as no target: everything.
 */
export function parseTargets(args: readonly string[]): Targets {
  const targets: Targets = { all: false, twemoji: false, families: [], defaultFonts: false }
  let sawFontsKeyword = false

  for (const arg of args) {
    if (arg === 'all') targets.all = true
    else if (arg === 'twemoji' || arg === 'emoji') targets.twemoji = true
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
  const bare = args.length === 0
  let failed = false

  if (bare || targets.all || targets.twemoji) {
    const ok = await installTwemojiStep(deps, io)
    failed ||= !ok
  }

  // `all` means every catalogued font, not just the smaller default set —
  // otherwise it would just be another way to spell "no target".
  const families = targets.all
    ? [...FONT_CATALOGUE]
    : bare || targets.defaultFonts
      ? DEFAULT_FONT_FAMILIES
      : targets.families
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
  const everything = args.length === 0 || targets.all
  let failed = false

  if (everything || targets.twemoji) {
    try {
      const info = await (deps.twemojiInfo ?? twemojiInfo)()
      await (deps.uninstallTwemoji ?? uninstallTwemoji)()
      io.line(
        info.images > 0 ? `Removed Twemoji (${info.images} images)` : 'Twemoji was not installed',
      )
    } catch (cause) {
      io.line(`✗ Twemoji — ${cause instanceof Error ? cause.message : String(cause)}`)
      failed = true
    }
  }

  if (everything || targets.defaultFonts || targets.families.length > 0) {
    const families = everything || targets.defaultFonts ? undefined : targets.families
    try {
      const removed = await (deps.uninstallFonts ?? uninstallFonts)(families)
      io.line(
        removed > 0
          ? `Removed ${removed} font file${removed === 1 ? '' : 's'}`
          : 'No fonts to remove',
      )
    } catch (cause) {
      io.line(`✗ Fonts — ${cause instanceof Error ? cause.message : String(cause)}`)
      failed = true
    }
  }

  return failed ? 1 : 0
}

export async function listCommand(
  deps: CliDeps,
  io: CliIo,
  options: OutputOptions = {},
): Promise<number> {
  const twemoji = await (deps.twemojiInfo ?? twemojiInfo)()
  const fonts = (deps.listInstalledFonts ?? listInstalledFonts)()

  if (options.json) {
    io.line(JSON.stringify({ twemoji, fontsDir: resolveCacheDir(), fonts }, null, 2))
    return 0
  }

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
export function searchCommand(
  query: string | undefined,
  io: CliIo,
  options: OutputOptions = {},
): number {
  const trimmed = query?.trim()
  // A query might be an alias (`pop`) rather than a substring of the real
  // name — checked separately, since e.g. `mplus` isn't a substring of
  // "M PLUS Rounded 1c".
  const aliasHit = trimmed ? resolveFontAlias(trimmed) : undefined
  const substringMatches: string[] = trimmed
    ? FONT_CATALOGUE.filter((family) => family.toLowerCase().includes(trimmed.toLowerCase()))
    : [...FONT_CATALOGUE]
  const matches =
    aliasHit && !substringMatches.some((family) => family === aliasHit)
      ? [aliasHit, ...substringMatches]
      : substringMatches

  if (options.json) {
    const suggestion = matches.length === 0 && trimmed ? (suggestionFor(trimmed) ?? null) : null
    io.line(JSON.stringify({ query: trimmed ?? null, matches, suggestion }, null, 2))
    return 0
  }

  if (matches.length > 0) {
    io.line(trimmed ? `Fonts miq knows by name matching "${trimmed}":` : 'Fonts miq knows by name:')
    for (const family of matches) {
      io.line(family === aliasHit ? `  ${family}  (alias "${trimmed}")` : `  ${family}`)
    }
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

export async function outdatedCommand(
  deps: CliDeps,
  io: CliIo,
  options: OutputOptions = {},
): Promise<number> {
  const packageStatus = await (deps.checkPackageUpdate ?? checkPackageUpdate)(currentVersion())
  const twemoji = await (deps.twemojiInfo ?? twemojiInfo)()
  const twemojiLatest =
    twemoji.version === null ? null : await (deps.latestTwemojiVersion ?? latestTwemojiVersion)()
  const fonts = (deps.listInstalledFonts ?? listInstalledFonts)()
  const fontStatuses =
    fonts.length > 0 ? await (deps.checkFontUpdates ?? checkFontUpdates)(fonts) : []

  const packageOutdated =
    packageStatus.latest !== null && isNewerVersion(packageStatus.current, packageStatus.latest)
  const twemojiOutdated =
    twemoji.version !== null &&
    twemojiLatest !== null &&
    isNewerVersion(twemoji.version, twemojiLatest)
  const fontsOutdated = fontStatuses.some((status) => status.outdated)
  const outdated = packageOutdated || twemojiOutdated || fontsOutdated

  if (options.json) {
    io.line(
      JSON.stringify(
        {
          package: packageStatus,
          twemoji:
            twemoji.version === null ? null : { installed: twemoji.version, latest: twemojiLatest },
          fonts: fontStatuses,
        },
        null,
        2,
      ),
    )
    return outdated ? 1 : 0
  }

  formatPackageUpdate(packageStatus, io)
  formatTwemojiUpdate(twemoji, twemojiLatest, io)

  if (fonts.length > 0) {
    io.line('Fonts')
    formatFontUpdates(fontStatuses, io)
  }

  if (!outdated) {
    io.line('')
    io.line('Everything checked is up to date.')
  }

  return outdated ? 1 : 0
}

/**
 * Applies what `outdated` only reports.
 *
 * Never touches the miq install itself — a newer miq is a hint to run
 * `npm install` yourself, not something this process should do to its own
 * package manager. Twemoji and fonts are miq's own managed files, so those
 * it updates directly: an outdated Twemoji release is uninstalled and
 * reinstalled clean (a plain re-run only adds new files, see
 * `installTwemoji`'s doc comment), and an outdated font family is
 * re-installed and then pruned so the stale version doesn't linger.
 */
export async function updateCommand(deps: CliDeps, io: CliIo): Promise<number> {
  let failed = false
  let didAnything = false

  const packageStatus = await (deps.checkPackageUpdate ?? checkPackageUpdate)(currentVersion())
  if (
    packageStatus.latest !== null &&
    isNewerVersion(packageStatus.current, packageStatus.latest)
  ) {
    io.line(
      `makeitaquote ${packageStatus.current} → ${packageStatus.latest} available — ` +
        'run `npm install -g makeitaquote@latest` yourself (miq never updates its own install)',
    )
  }

  const twemoji = await (deps.twemojiInfo ?? twemojiInfo)()
  if (twemoji.version !== null) {
    const latest = await (deps.latestTwemojiVersion ?? latestTwemojiVersion)()
    if (latest !== null && isNewerVersion(twemoji.version, latest)) {
      didAnything = true
      io.line('Twemoji')
      try {
        await (deps.uninstallTwemoji ?? uninstallTwemoji)()
        const result = await (deps.installTwemoji ?? installTwemoji)()
        io.line(`  ✓ updated to ${result.version}`)
      } catch (cause) {
        io.line(`  ✗ Twemoji — ${cause instanceof Error ? cause.message : String(cause)}`)
        failed = true
      }
    }
  }

  const fonts = (deps.listInstalledFonts ?? listInstalledFonts)()
  if (fonts.length > 0) {
    const statuses = await (deps.checkFontUpdates ?? checkFontUpdates)(fonts)
    const outdatedFamilies = statuses
      .filter((status) => status.outdated)
      .map((status) => status.family)

    if (outdatedFamilies.length > 0) {
      didAnything = true
      io.line('Fonts')
      const results = await (deps.installFonts ?? installFonts)(outdatedFamilies)
      for (const result of results) {
        if (result.ok) io.line(`  ✓ ${result.family}`)
        else {
          io.line(`  ✗ ${result.family} — not available (see the warning above)`)
          failed = true
        }
      }
      await (deps.pruneFonts ?? pruneFonts)(outdatedFamilies)
    }
  }

  if (!didAnything) io.line('Nothing to update.')

  return failed ? 1 : 0
}

/** Deletes stale-version font files, keeping only the newest per family. */
export async function pruneCommand(
  families: readonly string[],
  deps: CliDeps,
  io: CliIo,
): Promise<number> {
  const results = await (deps.pruneFonts ?? pruneFonts)(families.length > 0 ? families : undefined)

  if (results.length === 0) {
    io.line('Nothing to prune.')
    return 0
  }

  for (const result of results) {
    io.line(
      `  ✓ ${result.family} — removed ${result.removed} stale file${result.removed === 1 ? '' : 's'}, ${formatBytes(result.bytes)}`,
    )
  }
  return 0
}

/** Where things are, whether they're writable, and what's reachable — for debugging storage/network setup. */
export async function envCommand(
  deps: CliDeps,
  io: CliIo,
  options: OutputOptions = {},
): Promise<number> {
  const report = await (deps.checkEnv ?? checkEnv)()

  if (options.json) {
    io.line(JSON.stringify(report, null, 2))
    return report.storage.fontsWritable && report.storage.twemojiWritable ? 0 : 1
  }

  io.line('Storage')
  io.line(`  Project root           ${report.storage.projectRoot}`)
  io.line(
    `  Fonts                  ${report.storage.fontsDir} ` +
      (report.storage.fontsWritable ? '(writable)' : '(NOT writable)'),
  )
  io.line(
    `  Twemoji                ${report.storage.twemojiDir} ` +
      (report.storage.twemojiWritable ? '(writable)' : '(NOT writable)'),
  )
  io.line(`  MIQ_FONT_CACHE_DIR     ${report.storage.fontCacheDirEnv ?? '(not set)'}`)
  io.line(`  MIQ_TWEMOJI_CACHE_DIR  ${report.storage.twemojiCacheDirEnv ?? '(not set)'}`)
  io.line('')
  io.line('Network')
  for (const { host, reachable } of report.network) {
    io.line(`  ${host.padEnd(24)} ${reachable ? 'reachable' : 'unreachable'}`)
  }

  return report.storage.fontsWritable && report.storage.twemojiWritable ? 0 : 1
}

/** Raw `miq render` flag values, before `--avatar` is resolved to bytes. */
export interface RenderOptions {
  text?: string
  avatar?: string
  username?: string
  displayName?: string
  watermark?: string
  color?: boolean
  /** Validated by cleye's `oneOf()` before this ever runs — a plain string here, not re-checked. */
  theme?: string
  /** Same as `theme` — validated by cleye's `oneOf()` already. */
  layout?: string
  scale?: number
  /** Same as `theme` — already one of `RenderInput['format']`'s members by the time this runs. */
  format?: string
  quality?: number
  out?: string
  offline?: boolean
}

/** Generates a quote image from flag values, and writes it to `--out`. */
export async function renderCommand(
  options: RenderOptions,
  deps: CliDeps,
  io: CliIo,
): Promise<number> {
  if (!options.text) {
    io.line('Error: --text is required.')
    return 1
  }

  const format = (options.format ?? 'png') as RenderInput['format']
  const outPath = options.out ?? `quote.${format}`

  try {
    const avatar =
      options.avatar === undefined
        ? undefined
        : await (deps.resolveAvatar ?? resolveAvatar)(options.avatar)

    const bytes = await (deps.render ?? renderToBuffer)({
      text: options.text,
      ...(avatar !== undefined ? { avatar } : {}),
      ...(options.username !== undefined ? { username: options.username } : {}),
      ...(options.displayName !== undefined ? { displayName: options.displayName } : {}),
      ...(options.watermark !== undefined ? { watermark: options.watermark } : {}),
      ...(options.color !== undefined ? { color: options.color } : {}),
      ...(options.theme !== undefined ? { theme: options.theme as RenderInput['theme'] } : {}),
      ...(options.layout !== undefined ? { layout: options.layout as RenderInput['layout'] } : {}),
      ...(options.scale !== undefined ? { scale: options.scale } : {}),
      ...(options.quality !== undefined ? { quality: options.quality } : {}),
      format,
      ...(options.offline ? { offline: true } : {}),
    })

    await (deps.writeFile ?? writeFile)(outPath, bytes)
    io.line(`✓ ${outPath} (${formatBytes(bytes.length)})`)
    return 0
  } catch (cause) {
    io.line(`✗ ${cause instanceof Error ? cause.message : String(cause)}`)
    return 1
  }
}

function formatPackageUpdate(status: PackageUpdateStatus, io: CliIo): void {
  if (status.latest === null) {
    io.line(`  ? makeitaquote ${status.current} — could not reach the npm registry`)
  } else if (isNewerVersion(status.current, status.latest)) {
    io.line(
      `  ↑ makeitaquote ${status.current} → ${status.latest} — npm install -g makeitaquote@latest`,
    )
  } else {
    io.line(`  ✓ makeitaquote ${status.current} — up to date`)
  }
}

function formatTwemojiUpdate(info: TwemojiInfo, latest: string | null, io: CliIo): void {
  if (info.version === null) {
    io.line('  · Twemoji — not installed')
  } else if (latest === null) {
    io.line(`  ? Twemoji ${info.version} — could not reach jsDelivr`)
  } else if (isNewerVersion(info.version, latest)) {
    io.line(`  ↑ Twemoji ${info.version} → ${latest} — miq install twemoji`)
  } else {
    io.line(`  ✓ Twemoji ${info.version} — up to date`)
  }
}

function formatFontUpdates(statuses: readonly FontUpdateStatus[], io: CliIo): void {
  for (const status of statuses) {
    if (status.latestVersion === null) {
      io.line(`  ? ${status.family} — could not check`)
    } else if (status.outdated) {
      io.line(
        `  ↑ ${status.family} ${status.installedVersion} → ${status.latestVersion} — ` +
          `miq install fonts "${status.family}"`,
      )
    } else {
      io.line(`  ✓ ${status.family} — up to date`)
    }
  }
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

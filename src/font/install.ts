import { readdirSync, statSync, unlinkSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { isNewerVersion } from '../util/version'
import { type EnsureOptions, installFont } from './autoload'
import { normalizeFontFamily } from './catalogue'
import { resolveCacheDir } from './diskCache'
import { slugFor } from './googleFonts'

export interface FontInstallResult {
  family: string
  ok: boolean
}

export interface InstalledFont {
  /** The family name as written, recovered from the file name's slug. */
  family: string
  files: number
  bytes: number
  /** Every weight found on disk, sorted. */
  weights: number[]
  italic: boolean
  /**
   * The newest Google Fonts asset version found on disk, e.g. `v30`.
   *
   * Only newest, not necessarily only: a family updated upstream between one install and the next keeps its old files (see `uninstallFonts`'s doc comment), so more than one version can coexist under the same family.
   */
  version: string
}

export interface InstallFontsOptions extends EnsureOptions {}

/**
 * Downloads families into the on-disk cache, for offline rendering.
 *
 * Unlike a render-time `useFont`, this downloads even when the system already has the family — the file on disk is the whole point. Re-running is cheap: a file already cached is not fetched again.
 */
export async function installFonts(
  families: readonly string[],
  options: InstallFontsOptions = {},
): Promise<FontInstallResult[]> {
  const results: FontInstallResult[] = []
  for (const requested of families) {
    const family = normalizeFontFamily(requested)
    results.push({ family, ok: await installFont(family, options) })
  }
  return results
}

/**
 * Removes cached font files, returning how many went.
 *
 * With no families, the whole cache directory goes — runtime downloads live there too, and "uninstall fonts" means all of them. With families, only their files are deleted, identified by the slug every cache file starts with.
 */
export async function uninstallFonts(
  families?: readonly string[],
  dir = resolveCacheDir(),
): Promise<number> {
  if (!families || families.length === 0) {
    let removed = 0
    try {
      removed = readdirSync(dir).length
    } catch {
      return 0
    }
    await rm(dir, { recursive: true, force: true })
    return removed
  }

  let removed = 0
  for (const requested of families) {
    const family = normalizeFontFamily(requested)
    const prefix = `${slugFor(family)}-`
    let names: string[]
    try {
      names = readdirSync(dir).filter((name) => name.startsWith(prefix))
    } catch {
      continue
    }
    for (const name of names) {
      try {
        unlinkSync(join(dir, name))
        removed++
      } catch (cause) {
        // Already gone — someone else's race, not a failure of this one.
        if ((cause as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw cause
      }
    }
  }
  return removed
}

export interface PruneResult {
  family: string
  removed: number
  bytes: number
}

/**
 * Deletes stale-version font files, keeping only the newest per family.
 *
 * `installFonts`/`useFont` never delete an old version when Google ships a new one — a fresh file just lands alongside it (see `listInstalledFonts`'s `version` doc) — so this is the cleanup step for whatever `miq update` left behind, or for a cache that has simply been around a while. With no families, every family in the cache is checked.
 */
export async function pruneFonts(
  families?: readonly string[],
  dir = resolveCacheDir(),
): Promise<PruneResult[]> {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }

  const wanted = families
    ? new Set(families.map((family) => slugFor(normalizeFontFamily(family))))
    : null

  interface File {
    name: string
    version: string
    bytes: number
  }
  const byFamily = new Map<string, File[]>()

  for (const name of names) {
    const parsed = CACHED_FONT.exec(name)
    if (!parsed) continue
    const slug = parsed[1] as string
    if (wanted && !wanted.has(slug)) continue

    let bytes = 0
    try {
      bytes = statSync(join(dir, name)).size
    } catch {
      // Vanished between listing and stat; not worth failing over.
    }
    const list = byFamily.get(slug) ?? []
    list.push({ name, version: parsed[2] as string, bytes })
    byFamily.set(slug, list)
  }

  const results: PruneResult[] = []
  for (const [slug, files] of byFamily) {
    const newest = newestVersion(files.map((file) => file.version))
    const stale = files.filter((file) => file.version !== newest)
    if (stale.length === 0) continue

    let removed = 0
    let bytes = 0
    for (const file of stale) {
      try {
        unlinkSync(join(dir, file.name))
        removed++
        bytes += file.bytes
      } catch {
        // Already gone, or locked by another process on Windows.
      }
    }
    if (removed > 0) results.push({ family: slug.replaceAll('-', ' '), removed, bytes })
  }

  return results
}

/**
 * A cache file name, taken apart: `<slug>-<version>-<weight>[-italic]-<id>.ttf`.
 *
 * The slug is greedy, so it wins over a version-like id segment; the groups after it are anchored by their shapes.
 */
const CACHED_FONT = /^(.+)-(v\d+)-(\d+)(-italic)?-(.+)\.ttf$/

/**
 * What font files are in the cache, grouped by family.
 *
 * The family is read back out of the file name, so nothing has to be registered or fetched to list it. The slug's hyphens become spaces again, which round-trips the names this package itself writes.
 */
export function listInstalledFonts(dir = resolveCacheDir()): InstalledFont[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }

  interface Accumulator {
    family: string
    files: number
    bytes: number
    weights: number[]
    italic: boolean
    versions: string[]
  }

  const byFamily = new Map<string, Accumulator>()

  for (const name of names) {
    const parsed = CACHED_FONT.exec(name)
    if (!parsed) continue

    const slug = parsed[1] as string
    const weight = Number(parsed[3])

    let entry = byFamily.get(slug)
    if (!entry) {
      entry = {
        family: slug.replaceAll('-', ' '),
        files: 0,
        bytes: 0,
        weights: [],
        italic: false,
        versions: [],
      }
      byFamily.set(slug, entry)
    }

    entry.files++
    entry.weights.push(Number.isFinite(weight) ? weight : 400)
    entry.italic ||= parsed[4] !== undefined
    entry.versions.push(parsed[2] as string)
    try {
      entry.bytes += statSync(join(dir, name)).size
    } catch {
      // Vanished between listing and stat; not worth failing over.
    }
  }

  return [...byFamily.values()].map((entry) => ({
    ...entry,
    weights: [...new Set(entry.weights)].sort((a, b) => a - b),
    version: newestVersion(entry.versions),
  }))
}

/** The highest `vNN` tag among a family's cached files. */
function newestVersion(versions: readonly string[]): string {
  return versions.reduce((newest, version) => (isNewerVersion(newest, version) ? version : newest))
}

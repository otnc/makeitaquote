import { existsSync, readdirSync, statSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import writeFileAtomic from 'write-file-atomic'
import { findProjectRoot } from '../util/projectRoot'

/**
 * Where downloaded fonts live, in order of preference.
 *
 * Project-local by default — the nearest ancestor `package.json` to the
 * current working directory, not a directory shared by every project on the
 * machine. Sharing one cache across unrelated projects means one project's
 * `uninstall` can remove files another still expects, and different
 * `makeitaquote` versions on the same machine would fight over the same
 * files. `MIQ_FONT_CACHE_DIR` opts back into sharing a location explicitly,
 * cache or otherwise.
 *
 * A cache that survives restarts is what keeps the "downloads a font on first
 * use" behaviour from meaning "downloads a font on every boot".
 */
export function resolveCacheDir(override?: string): string {
  if (override) return override

  const fromEnv = process.env.MIQ_FONT_CACHE_DIR
  if (fromEnv) return fromEnv

  return join(findProjectRoot(), '.makeitaquote', 'fonts')
}

export function cachedFontPath(dir: string, fileName: string): string {
  return join(dir, fileName)
}

/** What is currently in the font cache, and how much space it takes. */
export function cacheInfo(dir = resolveCacheDir()): {
  dir: string
  files: string[]
  bytes: number
} {
  try {
    const files = readdirSync(dir)
    let bytes = 0
    for (const file of files) {
      try {
        bytes += statSync(join(dir, file)).size
      } catch {
        // Vanished between listing and stat; not worth failing over.
      }
    }
    return { dir, files, bytes }
  } catch {
    return { dir, files: [], bytes: 0 }
  }
}

/** Empties the font cache. Fonts already registered stay usable this run. */
export async function clearCache(dir = resolveCacheDir()): Promise<void> {
  await rm(dir, { recursive: true, force: true })
}

export function isCached(dir: string, fileName: string): boolean {
  const path = cachedFontPath(dir, fileName)
  try {
    return existsSync(path) && statSync(path).size > 0
  } catch {
    return false
  }
}

/**
 * Writes a font to the cache atomically.
 *
 * `write-file-atomic` writes to a temporary file and renames it into place —
 * so an interrupted download can never leave a half-written font that the
 * next run would happily try to register. Two processes racing both write
 * the same content, so whichever rename lands last is still correct.
 */
export async function writeCachedFont(
  dir: string,
  fileName: string,
  bytes: Buffer,
): Promise<string> {
  await mkdir(dir, { recursive: true })

  const target = cachedFontPath(dir, fileName)

  try {
    await writeFileAtomic(target, bytes)
  } catch (cause) {
    // On Windows a rename over a file another process just created can fail;
    // if the target is there and non-empty, that other process won the race.
    if (!isCached(dir, fileName)) throw cause
  }

  return target
}

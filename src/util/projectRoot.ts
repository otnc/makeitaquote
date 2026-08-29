import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Memoized by `startDir`: callers that rely on the `process.cwd()` default
 * (every font/Twemoji cache-dir resolution in a run) all walk the same
 * ancestors, and a project's own root doesn't move while the process is
 * alive.
 */
const cache = new Map<string, string>()

/**
 * The nearest ancestor of `startDir` (inclusive) that has a `package.json`.
 *
 * Falls back to `startDir` itself when the walk reaches the filesystem root
 * without finding one, so callers always get a usable directory rather than
 * having to handle `null`.
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
  const cached = cache.get(startDir)
  if (cached !== undefined) return cached

  let dir = startDir
  let root = startDir

  while (true) {
    if (existsSync(join(dir, 'package.json'))) {
      root = dir
      break
    }

    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  cache.set(startDir, root)
  return root
}

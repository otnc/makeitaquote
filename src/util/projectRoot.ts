import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * The nearest ancestor of `startDir` (inclusive) that has a `package.json`.
 *
 * Falls back to `startDir` itself when the walk reaches the filesystem root
 * without finding one, so callers always get a usable directory rather than
 * having to handle `null`.
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = startDir

  while (true) {
    if (existsSync(join(dir, 'package.json'))) return dir

    const parent = dirname(dir)
    if (parent === dir) return startDir
    dir = parent
  }
}

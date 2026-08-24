import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * This package's own version, read from `package.json` at run time.
 *
 * `package.json` sits two directories above wherever this module ends up
 * compiled to (`dist/cli/main.{mjs,cjs}`), the same distance `bin` in
 * `package.json` already assumes — so the version is never duplicated as a
 * literal in source.
 */
export function currentVersion(): string {
  const path = fileURLToPath(new URL('../../package.json', import.meta.url))
  const pkg = JSON.parse(readFileSync(path, 'utf8')) as { version: string }
  return pkg.version
}

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** Loads the built package and the current version. Exits if dist/ is missing. */
export async function loadPackage(root) {
  const distEntry = join(root, 'dist', 'index.mjs')
  if (!existsSync(distEntry)) {
    console.error('visual-check: dist/index.mjs not found. Run `npm run build` first.')
    process.exit(1)
  }

  const pkg = await import(pathToFileURL(distEntry).href)
  const packageVersion = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version

  return { pkg, packageVersion }
}

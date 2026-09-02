import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { root } from './paths.js'

const distEntry = join(root, 'dist', 'index.mjs')
if (!existsSync(distEntry)) {
  console.error('visual-check: dist/index.mjs not found. Run `npm run build` first.')
  process.exit(1)
}

export const {
  MiQ,
  MiQChain,
  FONT_CATALOGUE,
  COLOR_THEME_CATALOGUE,
  CUSTOM_COLOR_THEME_CATALOGUE,
  colorThemeGradient,
  colorThemeTextBase,
  stripMarkdown,
} = await import(pathToFileURL(distEntry).href)

export const packageVersion = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version

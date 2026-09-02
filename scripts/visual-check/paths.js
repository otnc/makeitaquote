import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCli } from './cli.js'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const assetsDir = join(root, 'assets')

export const cli = parseCli()
export const outDir = join(root, cli.out)

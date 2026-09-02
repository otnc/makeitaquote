import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { assetsDir } from './paths.js'

export const required = {
  png: join(assetsDir, 'demo.png'),
  jpg: join(assetsDir, 'demo.jpg'),
  urls: join(assetsDir, 'imageurllist.json'),
  discord: join(assetsDir, 'discordemoji.json'),
  misskey: join(assetsDir, 'misskeycustomemoji.json'),
}

for (const [name, path] of Object.entries(required)) {
  if (!existsSync(path)) {
    console.error(`visual-check: missing asset for "${name}": ${path}`)
    process.exit(1)
  }
}

const imageUrls = JSON.parse(await readFile(required.urls, 'utf8'))
export const discordEmoji = JSON.parse(await readFile(required.discord, 'utf8'))
export const misskeyEmoji = JSON.parse(await readFile(required.misskey, 'utf8'))
const pngBuffer = await readFile(required.png)

export const avatars = {
  illustration: required.png,
  photo: required.jpg,
  buffer: pngBuffer,
  url: imageUrls[0],
  none: null,
  broken: 'https://invalid.invalid/definitely-not-there.png',
}

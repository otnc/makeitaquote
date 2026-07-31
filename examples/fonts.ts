import { writeFile } from 'node:fs/promises'
import { fonts, MiQ } from 'makeitaquote'

// Name any Google Fonts family and it is fetched on first use. The file is
// resolved through the Google Fonts API each cold start, so it's always the
// current release rather than a version pinned inside the package.
await writeFile(
  'dela.png',
  await new MiQ()
    .setText('映える引用')
    .setUsername('otoneko.')
    .setTheme({ text: { font: 'Dela Gothic One, Noto Sans JP, sans-serif' } })
    .toBuffer('png'),
)

// The families this package lists. Anything else Google serves works too.
console.log(fonts.catalogue())

// Fetch ahead of time, so no render has to wait.
await fonts.use('Hachi Maru Pop')
await fonts.ensureDefaults()

// Add a real bold face rather than relying on the emulated one.
await fonts.use('Noto Sans JP', { weights: [400, 700] })

// Look up where Google serves a family, without downloading it.
console.log(await fonts.resolve('Vina Sans'))

// Fonts are only ever fetched from Google Fonts, which is exclusively
// open-licensed. Anything else is rejected by name — load it yourself instead.
fonts.registerFromPath('./fonts/Licensed.otf', 'Licensed Font')
await fonts.registerFromURL('https://example.com/font.ttf', 'Remote Font')

// Never touch the network: use the disk cache and system fonts only.
await new MiQ({ autoFont: { online: false } }).setText('offline').toBuffer('png')

console.log(fonts.cacheInfo())

import { writeFile } from 'node:fs/promises'
import { MiQ } from 'makeitaquote'

// No font setup needed: the first render downloads Noto Sans JP into a cache
// directory and reuses it from then on. Pass { autoFont: false } to opt out.
const png = await new MiQ()
  .setText('吾輩は猫である。名前はまだ無い。')
  .setAvatar('https://cdn.discordapp.com/embed/avatars/0.png')
  .setUsername('otoneko.')
  .setDisplayName('音猫｡')
  .setWatermark('Make it a Quote')
  .toBuffer('png')

await writeFile('quote.png', png)

// Other outputs
const webp = await new MiQ().setText('Hello World!').toBuffer('webp', { quality: 90 })
const dataUrl = await new MiQ().setText('Hello World!').toDataURL('png')
const stream = await new MiQ().setText('Hello World!').toStream('png')

console.log(webp.byteLength, dataUrl.slice(0, 32), stream.readable)

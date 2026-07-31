import { writeFile } from 'node:fs/promises'
import { MiQ } from 'makeitaquote'

// `:name@host:` carries its own host, so it needs no configuration.
await writeFile(
  'federated.png',
  await new MiQ()
    .setText('わーい :blobcat@other.example: たのしい')
    .setUsername('otoneko.')
    .toBuffer('png'),
)

// A bare `:name:` needs an instance to resolve against.
const png = await new MiQ({ misskey: 'https://misskey.example' })
  .setText('わーい :blobcat: たのしい :party@other.example:')
  .setUsername('otoneko.')
  .setDisplayName('音猫｡')
  .toBuffer('png')

await writeFile('misskey.png', png)

// `:name:`      → https://misskey.example/emoji/name.webp
// `:name@host:` → https://host/emoji/name.webp
// `:name@.:`    → the configured instance

// Anything that doesn't resolve is drawn exactly as written, so ordinary text
// containing colons survives untouched:
//
//   会議は 12:30:45 から   the inner :30: follows a digit
//   key:value:other       :value: follows a letter
//   :2024:                purely numeric name
//   :a:                   too short
await new MiQ({ misskey: 'https://misskey.example' })
  .setText('会議は 12:30:45 から、資料は key:value:other です')
  .setUsername('otoneko.')
  .toBuffer('png')

// Only resolve local shortcodes, ignoring anything federated:
await new MiQ({
  misskey: { instance: 'https://misskey.example', remote: false },
})
  .setText(':blobcat: is local, :party@other.example: is left as text')
  .toBuffer('png')

// Discord custom emoji need no configuration either — they carry their own id.
await new MiQ()
  .setText('やった <:chu_:1485918581815377950> 👼')
  .setUsername('otoneko.')
  .toBuffer('jpg') // 'jpg' works as an alias for 'jpeg'

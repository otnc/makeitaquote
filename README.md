# Make it a Quote

Turn a message into a quote image.

[![npm](https://img.shields.io/npm/v/makeitaquote)](https://www.npmjs.com/package/makeitaquote)
[![CI](https://img.shields.io/github/actions/workflow/status/otnc/makeitaquote/ci.yml?branch=main&label=ci)](https://github.com/otnc/makeitaquote/actions)
[![License](https://img.shields.io/github/license/otnc/makeitaquote)](LICENSE)
[![Node](https://img.shields.io/node/v/makeitaquote)](https://www.npmjs.com/package/makeitaquote)

**[See every option as a picture →](https://otnc.github.io/makeitaquote/)**

Renders locally — no API, no browser, no headless Chrome. Japanese line
breaking, Twemoji, Discord and Misskey custom emoji, and fonts that download
themselves are all built in.

```sh
npm install makeitaquote
```

```ts
import { writeFile } from 'node:fs/promises'
import { MiQ } from 'makeitaquote'

const png = await new MiQ()
  .setText('吾輩は猫である。名前はまだ無い。')
  .setAvatar('https://example.com/avatar.png')
  .setUsername('otoneko.')
  .setDisplayName('音猫｡')
  .toBuffer('png')

await writeFile('quote.png', png)
```

CommonJS works too — every entry point ships both `require` and `import`:

```js
const { writeFile } = require('node:fs/promises')
const { MiQ } = require('makeitaquote')

new MiQ()
  .setText('吾輩は猫である。名前はまだ無い。')
  .setAvatar('https://example.com/avatar.png')
  .setUsername('otoneko.')
  .setDisplayName('音猫｡')
  .toBuffer('png')
  .then((png) => writeFile('quote.png', png))
```

Requires Node.js 22 or newer.

---

## Contents

- [Discord bots](#discord-bots) — the one thing most people are here for
- [Themes](#themes) — six presets, and how to change them
- [Colors](#colors) — every notation, including transparency
- [Size](#size) — scaling, and fitting to the avatar
- [Fonts](#fonts) — automatic downloads, and the licence rules
- [Emoji](#emoji) — Twemoji, Discord, Misskey
- [Text](#text) — wrapping, kinsoku, overflow
- [Output](#output) — formats and streams
- [Using an external API](#using-an-external-api) instead of rendering locally
- [Errors](#errors) · [Platform support](#platform-support)
- [Migrating from v8](#migrating-from-v8)
- [Author](#author) · [Licence](#licence)

---

## Discord bots

```ts
import { AttachmentBuilder } from 'discord.js'
import { MiQ } from 'makeitaquote'

const png = await new MiQ().setFromMessage(message).toBuffer('png')

await message.reply({
  files: [new AttachmentBuilder(png, { name: 'quote.png' })],
})
```

```js
// CommonJS
const { AttachmentBuilder } = require('discord.js')
const { MiQ } = require('makeitaquote')

new MiQ().setFromMessage(message).toBuffer('png').then((png) => {
  message.reply({ files: [new AttachmentBuilder(png, { name: 'quote.png' })] })
})
```

`setFromMessage()` takes the content, the name and the avatar off the message.
It accepts anything shaped like a Discord message, so discord.js v13, v14 and
discord.js-selfbot-v13 all work without this package depending on any of them.

By default it uses what a reader of that server saw — the per-server avatar and
nickname. Either can be switched to the account-wide version:

```ts
new MiQ().setFromMessage(message, { avatar: 'global', name: 'global' })
```

| Option | Default | Alternative |
| --- | --- | --- |
| `avatar` | `'guild'` — per-server avatar | `'global'` — account avatar |
| `name` | `'nickname'` — server nickname | `'global'` — account name |

Whichever you choose, the other is still the fallback, so a message with only
one of them always renders.

---

## Themes

| Preset | | |
| --- | --- | --- |
| `dark` | default | Black, avatar left, quote right — the original look |
| `light` | | The same on white |
| `color` | | `dark`, but the avatar keeps its color |
| `portrait` | | Avatar fills the canvas and fades down, quote over the bottom |
| `portrait-light` | | The same on white |
| `custom` | | Everything transparent, for you to color in |

```ts
new MiQ({ theme: 'portrait' })      // at construction
new MiQ().setTheme('light')         // or later
```

Change any part of one without repeating the rest:

```ts
await new MiQ()
  .setText('…')
  .setTheme({
    extends: 'light',
    background: '#FFF8E7',
    text: { color: '#2B2B2B', align: 'left' },
    avatar: { grayscale: false, position: 'right' },
  })
  .toBuffer('webp', { quality: 90 })
```

Sizes inside a theme are **fractions of the canvas** when between 0 and 1, and
pixels when larger. That is what makes [scaling](#size) a true zoom.

### Flipping sides

```ts
.setTheme({ avatar: { position: 'right' } })
```

The quote area, the gradient and the watermark all mirror automatically —
`text.area` and `watermark.position` default to `'auto'`, which derives them
from where the avatar is. Only set `text.area` yourself if you want to place
the quote by hand.

### Portrait

```ts
await new MiQ({ theme: 'portrait' })
  .setText('猫は液体である')
  .setAvatar(avatarUrl)
  .setUsername('otoneko.')
  .toBuffer('png')
```

The `stacked` layout draws the avatar full-bleed, fades it downwards, and puts
large quote marks, the quote, a rule and the attribution over the bottom. It is
not limited to tall canvases — `{ extends: 'portrait', width: 1280, height: 720 }`
works too.

### Bold

```ts
.setTheme({ text: { weight: 'bold' }, displayName: { weight: 600 } })
```

Every text element takes a `weight`: `'normal'`, `'bold'`, or 100–900.

> Fonts registered at runtime often expose only their regular face, so `bold`
> would otherwise do nothing at all. Bold is detected per family and emulated by
> stroking the glyphs when there is no real bold face — so it works whatever
> font you use. Ask for a real one with `fonts.use(family, { weights: [400, 700] })`.

### Quote marks and rules

Both are off by default.

```ts
.setTheme({ quoteMark: { display: 'inline' } })                    // “like this”
.setTheme({ quoteMark: { display: 'inline', chars: ['「', '」'] } })
.setTheme({ quoteMark: { display: 'block' } })                     // large, above
.setTheme({ divider: { enabled: true } })                          // rule below
```

---

## Colors

Every color accepts any of these:

```
'#RGB'  '#RGBA'  '#RRGGBB'  '#RRGGBBAA'      hex, with or without alpha
0xRRGGBB  0xRRGGBBAA                         numbers
[r, g, b]  [r, g, b, a]                      channels 0–255, alpha 0–1 or 0–255
'transparent'                                fully clear
'rgb(…)'  'rgba(…)'                          CSS functions
```

> A number cannot carry a leading zero byte — `0x00FF0000` *is* `0xFF0000` — so
> write those as strings, where the length is part of the value.

### Starting from nothing

The `custom` preset begins fully transparent, so the only colors in the image
are the ones you name:

```ts
await new MiQ()
  .setText('…')
  .setAvatar(avatarUrl)
  .setTheme({
    extends: 'custom',
    background: '#1A1B26',
    text: { color: '#C0CAF5' },
    displayName: { color: '#7AA2F7' },
    username: { color: '#565F89' },
    watermark: { color: '#414868' },
  })
  .toBuffer('png')
```

Leave `background` alone and you get a PNG with a transparent background, ready
to composite. Anything left transparent is not drawn at all.

---

## Size

The default canvas is **800 on its long edge** — 1422×800 landscape, 800×1000
portrait.

```ts
.setScale(2)      // 2844×1600, the same image at twice the resolution
.setScale(0.5)    // half
```

`setScale()` is a genuine zoom: because theme sizes are fractions, nothing is
re-composed, only re-rendered.

To keep the avatar at its native resolution and let the canvas follow:

```ts
new MiQ({ sizeToAvatar: 'height' })   // or 'width'
```

For a different shape, set it on the theme:

```ts
.setTheme({ width: 1280, height: 720 })
```

> `setSize(width, height)` still works but is deprecated: it changes the aspect
> ratio without moving anything else, so the avatar, gradient and text drift out
> of proportion. It emits a Node deprecation warning, silenced by
> `--no-deprecation` like any other.

---

## Fonts

**Nothing to configure.** If the system has no font for the text, the first
render fetches one, caches it, and never fetches it again. The default is
M PLUS Rounded 1c, with Noto Sans JP behind it for anything it doesn't cover.

Name any font and it is fetched on demand:

```ts
.setTheme({ text: { font: 'Dela Gothic One, Noto Sans JP, sans-serif' } })
```

Fonts are resolved through the Google Fonts API on each cold start, so you get
the current release rather than a version frozen into this package.

### Mixing scripts

A Latin-only display font no longer turns Japanese into boxes. The chosen font
is used for everything it covers, and the rest falls through to a font that has
the glyphs:

```ts
.setTheme({ text: { font: 'Vina Sans' } })
// "Vina Sans と日本語" → Latin in Vina Sans, Japanese in the fallback
```

### The catalogue

Any Google Fonts family works. These are the ones `fonts.catalogue()` lists:

| | |
| --- | --- |
| Japanese | M PLUS Rounded 1c · Noto Sans JP · Dela Gothic One · DotGothic16 · Hachi Maru Pop · Rampart One · Reggae One · RocknRoll One · Zen Old Mincho · Yuji Syuku · Yusei Magic |
| Latin | Inconsolata · Exo 2 · Bruno Ace SC · Poltawski Nowy · Vina Sans · Dancing Script |

### Licensing

**Fonts are only ever fetched from Google Fonts**, which distributes exclusively
under the SIL Open Font License, Apache 2.0 or the Ubuntu Font Licence — all of
which allow rendering text into images freely.

That is also the licence check. A paid font, or one with unclear terms, is not
on Google Fonts, so it cannot be fetched by name and this package will not look
elsewhere for it:

```
"Jiyu no Tsubasa" is not distributed through Google Fonts; its licence is
unclear. Download it yourself and register it with fonts.registerFromPath().
```

Fonts you have licensed yourself load directly, with no restriction or check:

```ts
fonts.registerFromPath('./fonts/Licensed.otf', 'Licensed Font')
await fonts.registerFromURL('https://example.com/font.ttf', 'Remote Font')
```

Rendering text produces an image, not a copy of the font, and every licence
above permits that. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md),
including the **Twemoji attribution requirement** if you publish what you
generate.

### Controlling it

```ts
await fonts.use('Dela Gothic One')                       // fetch by name
await fonts.use('Noto Sans JP', { weights: [400, 700] }) // with a real bold
await fonts.ensureDefaults()                             // fetch up front

fonts.catalogue()                  // the list above
await fonts.resolve('Vina Sans')   // where Google serves it, without downloading
fonts.cacheInfo()                  // what is cached, and how large

new MiQ({ autoFont: false })                     // never fetch
new MiQ({ autoFont: { online: false } })         // the same
new MiQ({ autoFont: false, strictFonts: true })  // and throw if missing
```

The cache lives at `$MIQ_FONT_CACHE_DIR`, then `$XDG_CACHE_HOME`, then
`~/.cache/makeitaquote/fonts` (`%LOCALAPPDATA%` on Windows). Pre-populate it and
the package works entirely offline.

**Docker** — bake the fonts in so containers never fetch at runtime:

```dockerfile
ENV MIQ_FONT_CACHE_DIR=/app/.fonts
RUN node -e "import('makeitaquote').then(m => m.fonts.ensureDefaults())"
```

---

## Emoji

| Source | Written as | Needs setup |
| --- | --- | --- |
| Twemoji | any Unicode emoji | no |
| Discord | `<:name:id>`, `<a:name:id>` | no |
| Misskey | `:name@host:` | no |
| Misskey | `:name:` | an instance to resolve against |

Images are cached in memory, concurrent requests for the same emoji are shared,
and a failed fetch draws the source text instead of failing the render.
Animated emoji are drawn as their first frame.

### Misskey

`:name@host:` carries its own host and works out of the box. A bare `:name:`
needs somewhere to point:

```ts
new MiQ({ misskey: 'https://misskey.example' })
new MiQ({ misskey: ['https://one.example', 'https://two.example'] })
```

With several instances, each is tried in turn and the first that actually
serves the emoji wins — useful for a bot spanning more than one.

**Anything that doesn't resolve is drawn exactly as written**, so ordinary text
is never mangled. A shortcode only counts as emoji when it doesn't follow an
ASCII alphanumeric and its name isn't purely numeric:

```
12:30:45          the inner :30: follows a digit
https://a.test/   the :// isn't a name
key:value:other   :value: follows a letter
:2024:            purely numeric
:a:               too short
```

To ignore federated emoji entirely:

```ts
new MiQ({ misskey: { instance: 'https://misskey.example', remote: false } })
```

### Cache

```ts
configureEmojiCache({ maxEntries: 512, ttlMs: 7_200_000 })
```

Avatars get their own, separate cache — handy when the same user is quoted
several times in a row. Its default TTL is much shorter (five minutes) since
an avatar is one person's current picture, not a shared asset:

```ts
configureAvatarCache({ maxEntries: 128, ttlMs: 60_000 })
```

---

## Text

Japanese wraps at phrase boundaries using
[BudouX](https://github.com/google/budoux), with kinsoku rules applied, and the
font size shrinks until the quote fits its box.

```ts
.setTheme({ text: { phraseBreak: false } })   // break per character instead
.setTheme({ text: { overflow: 'shrink' } })   // let it spill rather than trim
.setTheme({ text: { overflow: 'error' } })    // throw instead
```

`overflow` defaults to `'ellipsis'`. Long unbreakable runs — URLs, for
instance — are split at grapheme boundaries rather than allowed to overflow.

---

## Output

```ts
await miq.toBuffer('png')                    // Buffer
await miq.toBuffer('jpeg', { quality: 90 })  // png | jpeg | jpg | webp | avif
await miq.toBuffer('jpg')                    // 'jpg' is an alias for 'jpeg'
await miq.toStream('png')                    // Readable
await miq.toDataURL('png')                   // data:image/png;base64,…
await miq.render()                           // the Canvas, to draw on yourself
```

---

## Using an external API

If you would rather not render locally at all:

```ts
import { VoidsMiQ } from 'makeitaquote/api'

const url = await new VoidsMiQ().setText('Hello World!').toURL()
const png = await new VoidsMiQ().setText('Hello World!').toBuffer()
```

The two endpoints do different things, so the method picks one:

| | `toURL()` | `toBuffer()` |
| --- | --- | --- |
| Endpoint | `/fakequote` | `/fakequotebeta` |
| Returns | a hosted image URL | the image bytes |
| Round trips | 1 | 1 |
| Stored on their server | **yes** | no |

`toBuffer({ hosted: true })` uploads and then downloads it back — two round
trips, only useful if you specifically want the bytes of the hosted image.

Importing `makeitaquote/api` does not load the rendering stack, so it also
works on platforms `@napi-rs/canvas` has no binary for.

> The Voids API is not operated by this package's developer. Please don't open
> issues here about it being down.

---

## Errors

Everything thrown extends `MiQError`:

```
MiQError
├─ ValidationError          bad input (carries .field)
├─ FontNotAvailableError    no font, with strictFonts on
├─ AssetFetchError          an avatar, emoji or font could not be fetched
├─ RenderError              drawing failed, or text could not be made to fit
└─ VoidsApiError            the API refused or failed (.status, .body, .endpoint)
```

A missing emoji or avatar never throws by default — the image degrades instead.

---

## Platform support

`@napi-rs/canvas` ships prebuilt binaries for macOS (x64/arm64), Linux
(x64/arm64/arm, glibc **and musl**), Windows (x64/arm64) and Android arm64.
Nothing to compile, Alpine included.

On a platform without a binary, use `makeitaquote/api`.

---

## Migrating from v8

v9 is a rewrite: the API changed, and images render locally by default.
See [MIGRATING.md](MIGRATING.md) for the full guide, including the v8 → v9
method table.

---

## Author

otoneko. https://github.com/otnc

---

## Licence

MIT — see [LICENSE](LICENSE).

Third-party assets are fetched at runtime: fonts from Google Fonts (OFL /
Apache 2.0 / UFL) and emoji from Twemoji, which is **CC-BY 4.0 and requires
attribution** if you publish the images:

> Emoji graphics by [Twemoji](https://github.com/jdecked/twemoji) (CC-BY 4.0).

[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) has the details.

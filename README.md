# Make it a Quote

Turn a message into a quote image.

[![npm](https://img.shields.io/npm/v/makeitaquote)](https://www.npmjs.com/package/makeitaquote) [![CI](https://img.shields.io/github/actions/workflow/status/otnc/makeitaquote/ci.yml?branch=main&label=ci)](https://github.com/otnc/makeitaquote/actions) [![License](https://img.shields.io/github/license/otnc/makeitaquote)](LICENSE) [![Node](https://img.shields.io/node/v/makeitaquote)](https://www.npmjs.com/package/makeitaquote) [![技術者倫理|遵守済み](https://gijutsusharin.li/badge.svg)](https://gijutsusharin.li)

**[See every option as a picture →](https://otnc.github.io/makeitaquote/)**

Renders locally — no API, no browser, no headless Chrome. Japanese line breaking, Twemoji, Discord and Misskey custom emoji, and fonts that download themselves are all built in.

```sh
npm install makeitaquote
```

| Default (`dark`) | `color` |
| --- | --- |
| ![Sample quote image, default dark theme](assets/readme/mono.png) | ![Sample quote image, color theme](assets/readme/color.png) |

> [!Note]
>   
> The self-hosted Make it a Quote Bot is now open source:  
> https://github.com/otnc/OpenMiQ

> [!Important]
>   
> `VoidsMiQ` (`makeitaquote/api`) has been removed and moved to another package: https://github.com/otnc/makeitaquote-voids
> ```bash
> npm install @makeitaquote/voids
> ```

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
- [Misskey notes](#misskey-notes) — quoting a note, and MFM
- [X (Twitter)](#x-twitter) — quoting a tweet, via FxTwitter or the official API
- [Markdown](#markdown) — strip it, leave it raw, or render bold/italic/underline/strikethrough
- [Conversations](#conversations) — several messages as one image
- [Themes](#themes) — palettes, layouts, and how to change them
- [Colors](#colors) — every notation, including transparency
- [Size](#size) — scaling, and fitting to the avatar
- [Fonts](#fonts) — automatic downloads, and the licence rules
- [Emoji](#emoji) — Twemoji, Discord, Misskey
- [Text](#text) — wrapping, kinsoku, overflow
- [Output](#output) — formats and streams
- [Offline use](#offline-use) — the `miq` command, and installing assets ahead of time
- [Errors](#errors) · [Platform support](#platform-support)
- [Migrating](#migrating)
- [Requirements](#requirements) · [Contributing](#contributing) · [Author](#author) · [Licence](#licence)

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

`setFromMessage()` takes the content, the name and the avatar off the message. It accepts anything shaped like a Discord message, so discord.js v13, v14 and discord.js-selfbot-v13 all work without this package depending on any of them.

By default it uses what a reader of that server saw — the per-server avatar and nickname. Either can be switched to the account-wide version:

```ts
new MiQ().setFromMessage(message, { avatar: 'global', name: 'global' })
```

| Option | Default | Alternative |
| --- | --- | --- |
| `avatar` | `'guild'` — per-server avatar | `'global'` — account avatar |
| `name` | `'nickname'` — server nickname | `'global'` — account name |
| `markdown` | `'raw'` — quoted exactly as written | `false` strips it, `'discord'` renders it — see [Markdown](#markdown) |
| `resolveMentions` | `true` — `<@id>` becomes `@name` | `false` — quoted as the raw token |

Whichever avatar or name you choose, the other is still the fallback, so a message with only one of them always renders.

`message.content` normally comes through untouched — `**bold**` is quoted with its asterisks and all, since that is what was actually typed. Opt into plain text with `markdown: false`, actually draw the bold/italic/underline/strikethrough with `markdown: 'discord'` (see [Markdown](#markdown)), or call the exported `stripDiscordMarkdown()` yourself on any text:

```ts
import { stripDiscordMarkdown } from 'makeitaquote'

stripDiscordMarkdown('**bold**, *italic*, ~~strike~~, `code`') // → 'bold, italic, strike, code'
```

It handles what Discord message content actually renders — bold, italic, underline, strikethrough, spoilers, code (inline and fenced), block quotes (`>` at the start of a line, same as Discord), headers, subtext (`-# `), list markers (`-`, `*`, `1.`) and masked links (`[text](url)` reduces to `text`) — and honours a backslash escape. A code span keeps markdown inside it literal, so `` `**x**` `` keeps its asterisks (a backslash escape is the one exception — `` `\*x\*` `` still resolves to `*x*`, since Discord's own client is the only thing that treats a code span's contents as fully inert).

This runs on [`discomd`](https://www.npmjs.com/package/discomd), Discord's own dialect rather than CommonMark. A generic Markdown stripper gets real things wrong here, like reading `__x__` as bold instead of underline.

> [!NOTE]
> `stripDiscordMarkdown: true`/`false` still works, but is deprecated — `markdown: false`/`'raw'` says the same thing and also lets you ask for `'discord'` rendering instead of stripping. See [Markdown](#markdown).

### Tokens

Discord writes several things as markup only the client expands. All of them are resolved by default:

| Written as                     | Becomes                           |
| ------------------------------ | --------------------------------- |
| `<@id>`, `<@!id>`              | `@nickname`                       |
| `<@&id>`                       | `@role`                           |
| `<#id>`                        | `#channel`                        |
| `</name:id>`, `</name sub:id>` | `/name sub`                       |
| `<t:1618935630:F>`             | `Tuesday, 20 April 2021 at 16:20` |
| `<id:customize>`               | `Channels & Roles`                |

Names come from `message.mentions`, which discord.js populates for you — nothing to configure. A mention it has no name for (someone who has since left) is left exactly as written rather than guessed at; the rest carry everything they need in the token. Set `resolveMentions: false` to quote the raw tokens instead.

A `<t:…>` timestamp is the one token whose text depends on who is looking — Discord renders it in the reader's own locale and zone. An image has no reader to ask, so it uses UTC and `en-GB`:

```ts
new MiQ().setFromMessage(message, {
  resolveMentions: { locale: 'ja-JP', timeZone: 'Asia/Tokyo' },
})
```

---

## Misskey notes

`setFromNote()` reads a note the way `setFromMessage()` reads a message. It takes what the API returns, unchanged:

```ts
const note = await fetch('https://misskey.example/api/notes/show', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ noteId }),
}).then((r) => r.json())

const png = await new MiQ({ misskey: 'https://misskey.example' })
  .setFromNote(note)
  .toBuffer('png')
```

The display name goes over the handle, which is written `@user` locally and `@user@host` for a remote author — exactly as Misskey writes it.

| Option     | Default                                                                 |
| ---------- | ------------------------------------------------------------------------ |
| `markdown` | `false` — strips it, `$[jelly x]` becomes `x` — see [Markdown](#markdown) |
| `preferCw` | `false` — quotes the note, not the content warning                       |

MFM is stripped by default, unlike Discord's markdown, because the markup differs: `**bold**` still reads as its own text with the asterisks left in, while `$[jelly ぷりん]` does not — the function name and brackets are scaffolding that was never meant to be read. Pass `markdown: 'misskey'` to actually draw the bold/italic/strikethrough instead of stripping it.

`stripMfm()` is exported on its own too, and handles decoration functions (including nested ones), `<b>`/`<i>`/`<s>`/`<small>`, `<center>`, quotes, code, maths and links. Custom emoji, mentions and hashtags are deliberately left alone — the emoji layer draws the first, and unlike Discord, a Misskey mention is written `@user@host` in the note already, so there is no id to resolve.

> [!NOTE]
> `stripMfm: true`/`false` still works, but is deprecated — `markdown: false`/`'raw'` says the same thing and also lets you ask for `'misskey'` rendering instead of stripping. See [Markdown](#markdown).

`MiQConversation` has `setFromNotes()` for the same thing across several notes.

---

## X (Twitter)

`setFromTweet()` reads a tweet the way `setFromMessage()` reads a message — but unlike Discord or Misskey, neither of X's two practical APIs hands back something `TweetLike` accepts as-is, so an adapter comes with each:

```ts
import { FxTwitterV2 } from 'fxtwitter/v2'
import { fromFxTwitterStatus } from 'makeitaquote'

const { status } = await new FxTwitterV2().getStatus(tweetId)

const png = await new MiQ().setFromTweet(fromFxTwitterStatus(status)).toBuffer('png')
```

[`fxtwitter`](https://www.npmjs.com/package/fxtwitter) needs no API key and returns the author inline, which is the easier path. For the official API, `fromTwitterApiV2Tweet()` combines a tweet with the separate `includes.users` entry [`twitter-api-v2`](https://www.npmjs.com/package/twitter-api-v2) (or any client with the same response shape) returns it in:

```ts
import { TwitterApi } from 'twitter-api-v2'
import { fromTwitterApiV2Tweet } from 'makeitaquote'

const { data: tweet, includes } = await client.v2.singleTweet(tweetId, {
  expansions: ['author_id'],
  'user.fields': ['profile_image_url'],
})

const png = await new MiQ()
  .setFromTweet(fromTwitterApiV2Tweet(tweet, includes))
  .toBuffer('png')
```

Neither library is a dependency of this package — both adapters take a structural subset of the real response shape, the same as `MessageLike`, so any object with those fields works, whether or not the library that produced it is actually installed.

There is no markup for either adapter to strip: X does not expand a tweet's `t.co` links or `@handle` mentions into anything else in its own timeline, so the text goes through exactly as written by default, the same way a Discord `@everyone` needs no resolving. `setFromTweet()` still takes a `markdown` option, though — a tweet has no real syntax, but "Twitter bold/italic" (the Unicode Mathematical Alphanumeric Symbols some clients paste in place of real formatting) is common enough to be worth acting on:

```ts
new MiQ().setFromTweet(tweet, { markdown: 'twitter' }) // renders 𝗕𝗼𝗹𝗱/𝘪𝘵𝘢𝘭𝘪𝘤 as real bold/italic
new MiQ().setFromTweet(tweet, { markdown: false }) // normalizes it back to plain ASCII instead
```

See [Markdown](#markdown).

---

## Markdown

Quoted text can be stripped, left exactly as written, or actually rendered — bold, italic, underline and strikethrough drawn onto the image instead of just having their markup removed. One option controls all of it: `markdown`, settable per call on `setFromMessage()`, `setFromNote()`, `setFromTweet()`, `setText()` and `setFromObject()`, and as a package-wide default via `new MiQ({ markdown })`:

| `markdown` | Effect |
| --- | --- |
| `false` | Strip to plain text immediately, with whichever parser fits the source (`stripDiscordMarkdown()`/`stripMfm()`/`stripMarkdown()` for `setFromMessage()`/`setFromNote()`/everything else; for `setFromTweet()`, normalizes Unicode "Twitter bold/italic" back to plain ASCII) |
| `'raw'` | Leave the text exactly as written — markup characters are drawn as literal text |
| `true` | Render standard CommonMark+GFM: **bold**, *italic*, ~~strikethrough~~, plus the `<u>`, `<b>`/`<strong>`, `<i>`/`<em>`, `<s>`/`<del>` raw HTML tags |
| `'discord'` | Render Discord's own dialect: bold, italic, underline, strikethrough |
| `'misskey'` | Render MFM's bold, italic, strikethrough |
| `'twitter'` | Render Unicode "Twitter bold/italic" as real bold/italic |

```ts
new MiQ().setText('**bold**, _italic_, and <u>underline</u>', { markdown: true }).toBuffer('png')
```

Default is off — `'raw'` for `setFromMessage()`/`setFromTweet()`/`setText()`/`setFromObject()` (matching each one's behaviour before this option existed), `false` for `setFromNote()` (matching `stripMfm`'s old default). Nothing changes unless you opt in.

Headings, MFM's `<small>`/`<center>`, and anything else that would change font size or layout are drawn as plain structural text rather than picking up a size — only the four style flags are actually rendered.

For a source that is neither Discord, Misskey nor X — a blog post, a GitHub comment, a Mastodon toot — `setText()`/`setFromObject()` treat `markdown` as standard CommonMark, the same as `true` above. `stripMarkdown()` is also exported on its own, for anywhere you just want the plain-text version of some CommonMark:

```ts
import { stripMarkdown } from 'makeitaquote'

stripMarkdown('**bold**, *italic*, ~~strike~~, [a link](url)')
// → 'bold, italic, strike, a link'
```

A link or image keeps its label/alt text and drops the URL — that is what a reader saw, not the address behind it — and raw inline/block HTML that isn't one of the four style tags above is dropped rather than rendered or left as literal tag text. A list item becomes one line, a table becomes tab-separated cells, and a hard line break (two trailing spaces) becomes a real one.

This is built on [`markdown-it`](https://www.npmjs.com/package/markdown-it) rather than a local approximation, the same reasoning as `stripDiscordMarkdown()` and `stripMfm()`: CommonMark has enough corners — reference-style `[label][ref]` links, loose vs. tight lists, a fenced code block's language tag — that matching a real implementation is worth the dependency.

> [!NOTE]
> `stripDiscordMarkdown`/`stripMfm` (the two old per-source booleans) still work, but are deprecated: `markdown` says the same thing they did, plus lets you render instead of just stripping.

---

## Conversations

`MiQ` quotes one message. `MiQConversation` renders several as one image — a message log, not a quote — each with its own avatar, name and wrapped text:

```ts
const png = await new MiQConversation()
  .addMessage({ username: 'otoneko.', displayName: '音猫｡', text: '吾輩は猫である。' })
  .addMessage({ username: 'otoneko.', displayName: '音猫｡', text: '名前はまだ無い。' })
  .addMessage({ username: 'someone', text: 'Cats are liquid, by volume.' })
  .toBuffer('png')
```

Consecutive messages from the same `username` collapse onto one avatar and name, the same way Discord's own client groups them.

Straight from real messages, the same way `MiQ#setFromMessage()` reads one — content, name, avatar, and the same `avatar` / `name` / `stripDiscordMarkdown` / `resolveMentions` options:

```ts
new MiQConversation().setFromMessages(messages) // messages: an array, oldest first
```

A separate class rather than an array mode on `MiQ`, because it has none of a quote's per-field theming — two built-in looks, not the full `Theme` system:

```ts
new MiQConversation({ theme: 'light', width: 500 })
```

| Option  | Default                            |
| ------- | ---------------------------------- |
| `theme` | `'dark'` — `'light'` is the other  |
| `width` | `600` — height follows the content |

Custom emoji, Twemoji and Misskey emoji all work inside a message the same way they do in `MiQ`, through the same `misskey` option.

---

## Themes

| Palette |  |  |
| --- | --- | --- |
| `dark` | default | Black, avatar left, quote right — the original look |
| `light` |  | The same on white |
| `custom` |  | Everything transparent, for you to color in |

```ts
new MiQ({ theme: 'dark' })      // at construction
new MiQ().setTheme('light')     // or later
```

A palette combines with `layout` (`'side'` (default) or `'new'` — see [New layout](#new-layout)) and any other override, so every combination is reachable without a preset name for each one:

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

Sizes inside a theme are **fractions of the canvas** when between 0 and 1, and pixels when larger. That is what makes [scaling](#size) a true zoom.

`themes` and `palettes` are exported too. `palettes` is the `dark`/`light` colour pairs presets are built from, for a custom theme that wants to start from one rather than repeat its hex codes. `themes` is the full resolved `Theme` behind each palette/layout pair — `themes.light.new`, for instance. `defineTheme(palette | input)` runs the same resolution `.setTheme()` does, if you want the resolved `Theme` itself rather than to render with it.

### Flipping sides

```ts
.setTheme({ avatar: { position: 'right' } })
```

The quote area, the gradient and the watermark all mirror automatically — `text.area` and `watermark.position` default to `'auto'`, which derives them from where the avatar is. Only set `text.area` yourself if you want to place the quote by hand.

### Avatar shape

```ts
.setTheme({ avatar: { shape: 'circle' } })
```

Clips the avatar, and its fallback tile, to the largest circle that fits the box — the default `'rectangle'` uses the whole box instead. On a wide or tall box that leaves background showing at the sides or top and bottom, the same as a round profile picture would anywhere else.

### New layout

```ts
await new MiQ({ theme: { layout: 'new' } })
  .setText('猫は液体である')
  .setAvatar(avatarUrl)
  .setUsername('otoneko.')
  .toBuffer('png')
```

Draws the avatar full-bleed, fades it downwards, and puts large quote marks, the quote, a rule and the attribution over the bottom. Combines with any palette (`{ extends: 'light', layout: 'new' }`) and is not limited to tall canvases — `{ layout: 'new', width: 1280, height: 720 }` works too.

### Bold

```ts
.setTheme({ text: { weight: 'bold' }, displayName: { weight: 600 } })
```

Every text element takes a `weight`: `'normal'`, `'bold'`, or 100–900.

> Fonts registered at runtime often expose only their regular face, so `bold` would otherwise do nothing at all. Bold is detected per family and emulated by stroking the glyphs when there is no real bold face — so it works whatever font you use. Ask for a real one with `fonts.use(family, { weights: [400, 700] })`.

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
'transparent'  'rebeccapurple'  'red'        any CSS colour name
'rgb(…)'  'hsl(…)'  'hwb(…)'  'lab(…)'       CSS colour functions, and more —
'lch(…)'  'oklab(…)'  'oklch(…)'  'color(…)'   anything culori itself parses
```

Strings go through [`culori`](https://www.npmjs.com/package/culori), which brings the 148 CSS colour names and the whole CSS Color 4 function set, converted to RGB for you. The number and array forms are this package's own.

> A number cannot carry a leading zero byte — `0x00FF0000` _is_ `0xFF0000` — so write those as strings, where the length is part of the value.

### Parsing a color yourself

The same parser is exported, for anything outside a theme that needs to read or normalize a color:

```ts
import { isTransparent, parseColor, toCSS, toHex } from 'makeitaquote'

parseColor('rebeccapurple')  // { r: 102, g: 51, b: 153, a: 1 }
toCSS({ r: 255, g: 0, b: 0, a: 0.5 })  // 'rgba(255, 0, 0, 0.5)'
toHex({ r: 255, g: 0, b: 0, a: 1 })    // '#FF0000FF'
isTransparent(parseColor('transparent'))  // true
```

### Starting from nothing

The `custom` preset begins fully transparent, so the only colors in the image are the ones you name:

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

Leave `background` alone and you get a PNG with a transparent background, ready to composite. Anything left transparent is not drawn at all.

### Background image

```ts
.setTheme({
  backgroundImage: { source: bannerUrl, fit: 'cover', opacity: 0.4 },
})
```

Drawn over `background` and behind everything else — `source` takes the same things `setAvatar()` does (a URL, a local path, a `Buffer`). `fit` is `'cover'` (crops to fill) or `'contain'` (fits whole, letterboxed in `background`). `null` (the default on every preset) means no image.

### Background gradient

```ts
.setTheme({
  backgroundGradient: {
    type: 'linear',
    direction: 'diagonal', // or 'horizontal' | 'vertical' | 'diagonal-reverse'
    stops: [
      ['#FF7E5F', 0],
      ['#6A3093', 1],
    ],
  },
})
```

A generated gradient fill — for a two-tone (or more) background without pre-rendering an image yourself. Drawn over `background` and behind `backgroundImage`, so a translucent stop still shows `background` underneath, and an opaque `backgroundImage` still draws on top of it. `null` (the default) means none.

`stops` is `[color, offset]` pairs, two or more, offsets 0–1 — any `ColorInput` works, including a translucent one. `type: 'radial'` fades outward from the canvas centre to its farthest corner instead of running along `direction`, which is then ignored:

```ts
.setTheme({
  backgroundGradient: {
    type: 'radial',
    direction: 'horizontal', // ignored
    stops: [
      ['#1A1B26', 0],
      ['#0F0F17', 1],
    ],
  },
})
```

The avatar-fade gradient (`theme.gradient`) composites correctly with either one — it fades the avatar's own edge into whatever is actually behind it, gradient or image included, rather than only ever working over a flat `background`.

### Named color themes

39 named background presets, in two catalogues: `COLOR_THEME_CATALOGUE` (21) and `CUSTOM_COLOR_THEME_CATALOGUE` (18, this package's own — every alias here is 4+ characters, since the 21 above already use most short ones). Kept apart rather than merged because a Discord select menu holds at most 25 options — pick one catalogue, a subset, or `ALL_COLOR_THEME_CATALOGUE` (both, concatenated) depending on how much room you have. Each entry gives its gradient and which text palette it needs for contrast; `resolveColorTheme()` turns a short alias, a full key, or a key without underscores into the key `colorThemeGradient()`/`colorThemeTextBase()` expect, checking every catalogue:

```ts
import { colorThemeGradient, colorThemeTextBase, resolveColorTheme } from 'makeitaquote'

const key = resolveColorTheme('mb') // 'midnight_blurple' — also accepts the key itself, any case
if (key) {
  await new MiQ()
    .setText('…')
    .setTheme({
      extends: colorThemeTextBase(key) === 'light' ? 'light' : 'dark',
      backgroundGradient: colorThemeGradient(key),
    })
    .toBuffer('png')
}
```

`extends` picks this package's own `light`/`dark` text palette, fixed per theme rather than left to a toggle of your own — a gradient needs a specific text color for contrast. Add `layout: 'new'` alongside it for a [new layout](#new-layout). Plain black/white backgrounds aren't in either catalogue: they're flat colors, already this package's own `dark`/`light` presets with no `backgroundGradient` needed.

---

## Size

The default canvas is **1200×630** for the `side` layout, **630×790** for `new` — not a round ratio, but the size a real deployment actually renders at.

```ts
.setScale(2)      // 2400×1260, the same image at twice the resolution
.setScale(0.5)    // half
```

`setScale()` is a genuine zoom: because theme sizes are fractions, nothing is re-composed, only re-rendered.

To keep the avatar at its native resolution and let the canvas follow:

```ts
new MiQ({ sizeToAvatar: 'height' })   // or 'width'
```

For a different shape, set it on the theme:

```ts
.setTheme({ width: 1280, height: 720 })
```

> `setSize(width, height)` still works but is deprecated: it changes the aspect ratio without moving anything else, so the avatar, gradient and text drift out of proportion. It emits a Node deprecation warning, silenced by `--no-deprecation` like any other.

---

## Fonts

**Nothing to configure.** If the system has no font for the text, the first render fetches one, caches it, and never fetches it again. The default is M PLUS Rounded 1c, with Noto Sans JP behind it as the general CJK safety net, and Nanum Gothic, Chiron GoRound TC, Noto Sans SC and IBM Plex Sans Arabic behind that for Korean, Traditional Chinese, Simplified Chinese and Arabic.

Name any font and it is fetched on demand:

```ts
.setTheme({ text: { font: 'Dela Gothic One, Noto Sans JP, sans-serif' } })
```

Fonts are resolved through the Google Fonts API on each cold start, so you get the current release rather than a version frozen into this package.

### Mixing scripts

A Latin-only display font no longer turns Japanese into boxes. The chosen font is used for everything it covers, and the rest falls through to a font that has the glyphs:

```ts
.setTheme({ text: { font: 'Vina Sans' } })
// "Vina Sans と日本語" → Latin in Vina Sans, Japanese in the fallback
```

### The catalogue

Any Google Fonts family works. These are the ones `fonts.catalogue()` lists:

|  |  |
| --- | --- |
| Japanese | M PLUS Rounded 1c · Noto Sans JP · Dela Gothic One · DotGothic16 · Hachi Maru Pop · Rampart One · Reggae One · RocknRoll One · Zen Old Mincho · Yuji Syuku · Yusei Magic |
| Latin | Inconsolata · Exo 2 · Bruno Ace SC · Poltawski Nowy · Vina Sans · Dancing Script · Castoro Titling |
| Script fallback | Nanum Gothic (Korean) · Chiron GoRound TC (Traditional Chinese) · Noto Sans SC (Simplified Chinese) · IBM Plex Sans Arabic (Arabic) — fetchable by name like any other entry, but fallback-only, so none of them has a `FONT_ALIASES` short name |

Short, typing-friendly names for the same list are in `FONT_ALIASES`:

```ts
import { FONT_ALIASES } from 'makeitaquote'

FONT_ALIASES.pop  // 'Hachi Maru Pop'
FONT_ALIASES.sans // 'Noto Sans JP'
```

Handy for exposing font choice through something like a Discord command option, without hand-rolling the same mapping yourself. To turn whatever a user actually typed — an alias, or the real name in any case — into the exact spelling `fonts.use()` expects, use `resolveFontAlias()`:

```ts
import { resolveFontAlias } from 'makeitaquote'

resolveFontAlias('pop')          // 'Hachi Maru Pop' (alias)
resolveFontAlias('POP')          // 'Hachi Maru Pop' (case-insensitive)
resolveFontAlias('dotgothic16')  // 'DotGothic16' (exact family name works too, any case)
resolveFontAlias('not-a-font')   // undefined
```

It only checks `FONT_ALIASES` and `FONT_CATALOGUE` — pair it with `suggestionFor()` if you want a "did you mean" hint when it comes back `undefined`.

You don't actually have to call `resolveFontAlias()` yourself, though — an alias works anywhere a font is named, resolved for you automatically:

```ts
.setTheme({ text: { font: 'pop' } })       // == 'Hachi Maru Pop'
.setTheme({ text: { font: 'pop, dot' } })  // == 'Hachi Maru Pop, DotGothic16'
await fonts.use('pop')                     // fetches Hachi Maru Pop
```

```
miq install pop
miq search mplus   # → M PLUS Rounded 1c (alias "mplus")
```

### Licensing

**Fonts are only ever fetched from Google Fonts**, which distributes exclusively under the SIL Open Font License, Apache 2.0 or the Ubuntu Font Licence — all of which allow rendering text into images freely.

That is also the licence check. A paid font, or one with unclear terms, is not on Google Fonts, so it cannot be fetched by name and this package will not look elsewhere for it:

```
"Jiyu no Tsubasa" is not distributed through Google Fonts; its licence is
unclear. Download it yourself and register it with fonts.registerFromPath().
```

Fonts you have licensed yourself load directly, with no restriction or check:

```ts
fonts.registerFromPath('./fonts/Licensed.otf', 'Licensed Font')
await fonts.registerFromURL('https://example.com/font.ttf', 'Remote Font')
```

Rendering text produces an image, not a copy of the font, and every licence above permits that. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md), including the **Twemoji attribution requirement** if you publish what you generate.

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
new MiQ({ autoFont: false, onAssetError: 'throw' })   // same, via the shared option
new MiQ({ autoFont: false, onAssetError: 'ignore' })  // fall back with no warning
```

The cache lives at `$MIQ_FONT_CACHE_DIR`, then `$XDG_CACHE_HOME`, then `~/.cache/makeitaquote/fonts` (`%LOCALAPPDATA%` on Windows). Pre-populate it and the package works entirely offline.

Everything above is also exported as its own function — `useFont`, `ensureDefaultFonts`, `resolveGoogleFont`, `FONT_CATALOGUE`, `isCatalogued`, `resolveCacheDir`, `DEFAULT_FONT_FAMILIES`, `FALLBACK_FAMILY` — for the rare case `fonts.*` doesn't cover; `fonts` itself is a thin wrapper over them.

**Docker** — bake the fonts in so containers never fetch at runtime:

```dockerfile
ENV MIQ_FONT_CACHE_DIR=/app/.fonts
RUN node -e "import('makeitaquote').then(m => m.fonts.ensureDefaults())"
```

---

## Emoji

| Source  | Written as                  | Needs setup                    |
| ------- | --------------------------- | ------------------------------ |
| Twemoji | any Unicode emoji           | no                             |
| Discord | `<:name:id>`, `<a:name:id>` | no                             |
| Misskey | `:name@host:`               | no                             |
| Misskey | `:name:`                    | an instance to resolve against |

Images are cached in memory, concurrent requests for the same emoji are shared, and a failed fetch draws the source text instead of failing the render. Animated emoji are drawn as their first frame.

### Misskey

`:name@host:` carries its own host and works out of the box. A bare `:name:` needs somewhere to point:

```ts
new MiQ({ misskey: 'https://misskey.example' })
new MiQ({ misskey: ['https://one.example', 'https://two.example'] })
```

With several instances, each is tried in turn and the first that actually serves the emoji wins — useful for a bot spanning more than one.

**Anything that doesn't resolve is drawn exactly as written**, so ordinary text is never mangled. A shortcode only counts as emoji when it doesn't follow an ASCII alphanumeric and its name isn't purely numeric:

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

Avatars get their own, separate cache — handy when the same user is quoted several times in a row. Its default TTL is much shorter (five minutes) since an avatar is one person's current picture, not a shared asset:

```ts
configureAvatarCache({ maxEntries: 128, ttlMs: 60_000 })
```

`emojiCacheInfo()`/`avatarCacheInfo()` report what's cached (entries, failures, in-flight requests); `clearEmojiCache()`/`clearAvatarCache()` empty one without waiting out its TTL.

---

## Text

Japanese wraps at phrase boundaries using [BudouX](https://github.com/google/budoux), with kinsoku rules applied, and the font size shrinks until the quote fits its box.

```ts
.setTheme({ text: { phraseBreak: false } })   // break per character instead
.setTheme({ text: { overflow: 'shrink' } })   // let it spill rather than trim
.setTheme({ text: { overflow: 'error' } })    // throw instead
```

`overflow` defaults to `'ellipsis'`. Long unbreakable runs — URLs, for instance — are split at grapheme boundaries rather than allowed to overflow.

Line count has a hard cap too, regardless of how much room shrinking would free up — 13 for `side`, 5 for `new` by default — past which it truncates instead of shrinking further. It can be raised, up to 20 for `side` or 10 for `new`:

```ts
.setTheme({ text: { maxLines: 20 } })
```

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

## Offline use

Fonts and Twemoji are normally fetched the first time they are needed and cached on disk after that. The CLI downloads them ahead of time instead, so renders never touch the network at all. It's available as both `miq` and `makeitaquote` once the package is installed — global or local, `npx` works either way:

```console
$ npx miq install
Twemoji
  ████████████████████████ 4009/4009
  ✓ Twemoji 17.0.3 — installed 4009 images
Fonts
  ✓ M PLUS Rounded 1c
  ✓ Noto Sans JP
  ✓ Nanum Gothic
  ✓ Chiron GoRound TC
  ✓ Noto Sans SC
  ✓ IBM Plex Sans Arabic
```

### Targets

`install` and `uninstall` both take the same target words:

| Target | Means |
| --- | --- |
| _(nothing)_ | Twemoji and the default fonts |
| `all` | Twemoji and **every** catalogued font (`miq search`) — bigger than the default above |
| `twemoji`, `emoji` | Just Twemoji |
| `fonts`, `font` | Just the default fonts, with no family names after it |
| `fonts "Name"` · `"Name"` | One or more specific families, by their Google Fonts name |

`all` only changes what `install` does — `uninstall all` and plain `uninstall` are identical, since removing everything doesn't care which fonts are catalogued. `outdated` takes no target; it always checks miq itself, Twemoji, and every installed font.

`install --no-fallback` skips Nanum Gothic, Chiron GoRound TC, Noto Sans SC and IBM Plex Sans Arabic — the fonts fetched automatically as script fallback (see [Fonts](#fonts)) but never selectable with `font=`. It only trims a broad target (no target, `all`, `fonts`); naming a family explicitly always installs it, fallback or not.

### Commands

| Command | Aliases | What it does |
| --- | --- | --- |
| `miq install [target…]` | `add`, `i` | Downloads a target (see above); no target = the default set |
| `miq uninstall [target…]` | `remove`, `rm`, `r`, `un`, `unlink` | Deletes a target; a real failure (a locked file, a permission error) is reported and exits non-zero rather than being silently skipped |
| `miq ls` | `list` | Lists what is installed — Twemoji included — how much it takes, and where |
| `miq search [query]` | `find`, `s` | Lists fonts miq knows by name; `miq search gothic` filters it |
| `miq outdated` |  | Checks miq itself, Twemoji, and every installed font against what's currently published |
| `miq update` |  | Applies what `outdated` finds — Twemoji and fonts only, never the miq install itself |
| `miq prune [family…]` |  | Deletes stale-version font files an update left behind, keeping the newest per family |
| `miq env` | `doctor` | Shows resolved storage paths, whether they're writable, and network reachability |
| `miq generate` | `render` | Generates a quote image from flags and writes it to disk |
| `miq --version` |  | Prints the installed miq version |

`ls`, `search`, `outdated` and `env` also take `--json`, for scripts and CI:

```console
$ miq outdated --json
{"package":{"current":"10.0.0","latest":"10.0.0"},"twemoji":{"installed":"17.0.3","latest":"17.0.3"},"fonts":[]}
```

`miq search` lists the curated names miq suggests and autocorrects typos against — any Google Fonts family works whether or not it's listed, since there is no way to enumerate Google's full ~1800-family catalogue without an API key, which this package deliberately doesn't ask you to configure.

### Keeping things current

`outdated` only reports; `update` acts on what it finds, and `prune` cleans up after it — a newer Twemoji release is reinstalled clean (a plain reinstall only adds new files, see below), and an outdated font is re-fetched and immediately pruned so the stale version doesn't linger. None of the three ever touch the miq install itself — a newer miq is a command to run yourself (`npm install -g makeitaquote@latest`), never something this process does to its own package manager:

```console
$ miq outdated
  ↑ makeitaquote 10.0.0 → 10.1.0 — npm install -g makeitaquote@latest
  ↑ Twemoji 17.0.3 → 17.0.4 — miq install twemoji
Fonts
  ✓ M PLUS Rounded 1c — up to date
$ miq update
Twemoji
  ✓ updated to 17.0.4
```

Re-running `install twemoji` after a new release only _adds_ files — it never deletes ones an update removed upstream — so `miq uninstall twemoji` first is how to force a clean re-download outside of `update`.

### Diagnosing a setup

`miq env` (alias `doctor`) prints where things resolve to, whether that location is actually writable, and whether the hosts miq talks to (Google Fonts, the Twemoji CDN, the npm registry) are reachable from here — handy for confirming a CI cache or a sandboxed environment is set up the way you expect:

```console
$ miq env
Storage
  Project root           /home/me/my-bot
  Fonts                  /home/me/my-bot/.makeitaquote/fonts (writable)
  Twemoji                /home/me/my-bot/.makeitaquote/twemoji (writable)
  MIQ_FONT_CACHE_DIR     (not set)
  MIQ_TWEMOJI_CACHE_DIR  (not set)

Network
  fonts.googleapis.com     reachable
  cdn.jsdelivr.net         reachable
  data.jsdelivr.com        reachable
  registry.npmjs.org       reachable
```

### Generating an image from the command line

`miq generate` (alias `render`) covers the common case as flags. For anything the full `Theme` system offers beyond that, use the library directly (see [Themes](#themes)):

| Flag | Does |
| --- | --- |
| `--text <string>` | The quoted text (required) |
| `--avatar <string>` | A URL, or a local image file |
| `--username`, `--display-name`, `--watermark <string>` | The same three fields `setUsername()`/`setDisplayName()`/`setWatermark()` set |
| `--theme <name>` | `dark` (default), `light` or `custom` |
| `--layout <name>` | `side` (default) or `new` |
| `--color` | Keep the avatar in color instead of desaturating it |
| `--scale <number>` | Resize the whole image, keeping its layout — up to 8 |
| `--format <name>` | `png` (default), `jpeg`/`jpg`, `webp` or `avif` |
| `--quality <number>` | 1–100, ignored for `png` |
| `--out <path>` | Where to write the image; defaults to `quote.<format>` |
| `--offline` | Never fetch a font — use only what's already installed |

```console
$ miq generate --text "吾輩は猫である。" --avatar https://…/avatar.png \
    --username otoneko. --display-name 音猫 --theme light --out quote.png
✓ quote.png (31 KB)
```

### Where things are stored

Storage is project-local by default: the nearest ancestor directory of `cwd` with a `package.json` (falling back to `cwd` itself if none is found), not a location shared by every project on the machine — so one project's `uninstall` never reaches into another's cache, and two projects on different `makeitaquote` versions never fight over the same files:

|         | Default location                       | Override                |
| ------- | -------------------------------------- | ----------------------- |
| Fonts   | `<project root>/.makeitaquote/fonts`   | `MIQ_FONT_CACHE_DIR`    |
| Twemoji | `<project root>/.makeitaquote/twemoji` | `MIQ_TWEMOJI_CACHE_DIR` |

Add `.makeitaquote/` to `.gitignore`. Everything under it is an ordinary file in an ordinary directory — deleting it uninstalls just as well as the CLI does.

After installing, renders work with the network down. Fonts already on disk are registered without asking Google first, and a Twemoji image is read from the local store instead of the CDN. Nothing changes until then — an uninstalled machine keeps fetching on first use exactly as before.

The install/uninstall/list operations are available programmatically too:

```ts
import { installFonts, installTwemoji, listInstalledFonts, twemojiInfo } from 'makeitaquote'

await installTwemoji() // → { version, total, downloaded, skipped }
await installFonts(['Dela Gothic One'])
listInstalledFonts() // → [{ family, files, bytes, weights, italic, version }]
await twemojiInfo() // → { images, bytes, version }
```

---

## Errors

Everything thrown extends `MiQError`:

```
MiQError
├─ ValidationError          bad input (carries .field)
├─ FontNotAvailableError    no font, with strictFonts or onAssetError: 'throw'
├─ AssetFetchError          an avatar, emoji or font could not be fetched
└─ RenderError              drawing failed, or text could not be made to fit
```

A missing emoji, avatar or font never throws by default — the image degrades instead. All three follow `onAssetError`; `strictFonts` is a font-specific override for it.

---

## Platform support

`@napi-rs/canvas` ships prebuilt binaries for macOS (x64/arm64), Linux (x64/arm64/arm, glibc **and musl**), Windows (x64/arm64) and Android arm64. Nothing to compile, Alpine included.

**Node.js** is the tested runtime (22+). **Bun** loads the native binding fine and both entry points (ESM and CJS) render correctly — it isn't part of CI, so treat it as working rather than officially supported. **Deno** hasn't been verified: its Node-API compatibility for native addons like this one is still maturing, and it needs `--allow-ffi`/`--allow-read` for the binding and font files besides.

On a platform without a binary, use [`@makeitaquote/voids`](https://github.com/otnc/makeitaquote-voids) — the external-API client that used to live here as `makeitaquote/api`.

---

## Migrating

v12 removes the `makeitaquote/api` subpath: the Voids API client moved out to its own package, [`@makeitaquote/voids`](https://github.com/otnc/makeitaquote-voids). v10 moved the default font/Twemoji cache from a location shared by every project on the machine to one inside your own project. v9 was a rewrite: the API changed, and images render locally by default. See [MIGRATING.md](MIGRATING.md) for the full guide, including the v8 → v9 method table.

---

## Requirements

- Node.js >= 22

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

---

## Author

otoneko. https://github.com/otnc

---

## Credits

### Inspiration

- Make it a Quote (Twitter) https://twitter.com/MakeItAQuote
- Make it a Quote (Discord / Misskey / Bluesky) https://miq.moe/

## Licence

MIT — see [LICENSE](LICENSE).

Third-party assets are fetched at runtime: fonts from Google Fonts (OFL / Apache 2.0 / UFL) and emoji from Twemoji, which is **CC-BY 4.0 and requires attribution** if you publish the images:

> Emoji graphics by [Twemoji](https://github.com/jdecked/twemoji) (CC-BY 4.0).

[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) has the details.

# Migrating

## From v11

### The `makeitaquote/api` subpath is gone

The Voids API client moved out of this package into its own, [`@makeitaquote/voids`](https://github.com/otnc/makeitaquote-voids). Nothing about it changed except where it is installed from and what the import specifier says:

```diff
- import { VoidsMiQ } from 'makeitaquote/api'
+ import { VoidsMiQ } from '@makeitaquote/voids'
```

```sh
npm install @makeitaquote/voids
```

`VoidsMiQ` (and its `MiQ` alias), `VoidsOptions`, `VoidsPayload`, `VoidsQuoteData`, `VoidsApiError`, `endpoints` and `DEFAULT_BASE_URL` all keep the same names and behaviour there. The method table below still applies.

Why: the two halves never shared anything but input validation, and they fail for entirely different reasons — one when a native binary is missing, the other when someone else's server is down. Keeping them in one package meant every local-rendering release also re-published an HTTP client for a third-party service this project doesn't operate, and every bug report had to start by asking which entry point it came from.

Nothing else changed. If you only ever imported `makeitaquote`, v12 is a no-op upgrade — `MiQError` and its subclasses are unaffected apart from `VoidsApiError`, which was only ever thrown by the subpath and now lives in the new package.

## From v10

### Theme presets: `portrait`/`portrait-light`/`color` are gone

`ThemeName` (`'dark' | 'light' | 'color' | 'portrait' | 'portrait-light' | 'custom'`) is now `ThemePalette` (`'dark' | 'light' | 'custom'`) — layout and color are independent settings now, not baked into one string per combination.

```diff
- .setTheme('portrait')
+ .setTheme({ layout: 'new' })

- .setTheme('portrait-light')
+ .setTheme({ extends: 'light', layout: 'new' })

- .setTheme('color')
+ .setTheme({ avatar: { grayscale: false } })
```

`layout` was already a `Theme` field (`'side' | 'new'`) — it just could not be combined freely with a palette before. `extends` now only accepts `'dark' | 'light' | 'custom'`.

`setFromObject({ color: true })` and the CLI's `--color` flag are unaffected. The CLI's `--theme` flag lost `color`/`portrait`/`portrait-light`; use `--theme dark|light|custom` with the new `--layout side|new` flag instead.

`themes`, exported from the package root, changed shape to match: it used to be one `Theme` per name, now it is `themes[palette][layout]` — `themes['portrait-light']` is `themes.light.new`.

## From v9

No API changes — everything that worked in v9 still works the same way. The breaking part is where downloaded fonts live by default.

### Font cache moved from a shared location to your project

v9 cached fonts in one place per machine: `$MIQ_FONT_CACHE_DIR`, else `$XDG_CACHE_HOME`, else `%LOCALAPPDATA%` on Windows, else `~/.cache`. v10 defaults to `<project root>/.makeitaquote/fonts` instead — the nearest ancestor directory with a `package.json`, found from `cwd`. A cache shared by every project on the machine meant one project's `uninstall` could reach into another's, and two projects pinned to different `makeitaquote` versions could fight over the same files; a project-local cache can't.

- Nothing breaks: a font not found in the new location is simply re-downloaded on first use, same as any first run ever was.
- Add `.makeitaquote/` to `.gitignore`.
- CI configured to cache the old global directory should point it at `.makeitaquote/` (relative to the project) instead.
- To keep the old shared location, set `MIQ_FONT_CACHE_DIR` yourself — it's read exactly as it was in v9, and still wins over the new default.

Twemoji images follow the same rule, at `<project root>/.makeitaquote/twemoji` (override with `MIQ_TWEMOJI_CACHE_DIR`) — new in v10, so there's nothing of yours to move.

### New: an offline CLI

`npm i makeitaquote` now installs `miq`/`makeitaquote` as a command:

```console
$ npx miq install       # fonts + Twemoji, ahead of time
$ npx miq generate --text "Hello" --out quote.png
```

See the [Offline use](README.md#offline-use) section of the README for the full command list (`install`, `uninstall`, `ls`, `search`, `outdated`, `update`, `prune`, `env`, `generate`). Entirely additive — nothing to migrate if you don't use it.

### New exports

`installTwemoji`, `uninstallTwemoji`, `twemojiInfo`, `resolveTwemojiDir`, `installFont`, `installFonts`, `listInstalledFonts` and `uninstallFonts` are all new, exported from the package root alongside the existing `resolveCacheDir`. `listInstalledFonts()` returns an `InstalledFont` per cached family, including a `version` field — the cached Google Fonts asset tag.

## From v8

v9 is a rewrite. The API changed, and images are now rendered locally by default.

> Coming from v8 to v12 rather than to v9: `makeitaquote/api` below is now `@makeitaquote/voids`, a separate install. See [From v11](#from-v11).

```diff
- const { MiQ } = require('makeitaquote')
+ const { MiQ } = require('makeitaquote')            // render locally
+ const { VoidsMiQ } = require('makeitaquote/api')   // keep using the API

  const buffer = await new MiQ()
      .setText(message.content)
-     .setDisplayname('音猫｡')
+     .setDisplayName('音猫｡')
-     .setColor(true)
+     .setTheme({ avatar: { grayscale: false } })
-     .generate(true)
+     .toBuffer('png')
```

| v8 | v9 (local) | v9 (API) |
| --- | --- | --- |
| `new MiQ()` | `new MiQ()` | `new VoidsMiQ()` |
| `.setDisplayname(v)` | `.setDisplayName(v)` | `.setDisplayName(v)` |
| `.setColor(true)` | `.setTheme({ avatar: { grayscale: false } })` | `.setColor(true)` |
| `.setText(v, true)` | `.setText(stripDiscordMarkdown(v))` | same |
| `.generate()` | — local rendering has no URL | `.toURL()` |
| `.generate(true)` | `.toBuffer('png')` | `.toBuffer({ hosted: true })` |
| `.generateBeta()` | `.toBuffer('png')` | `.toBuffer()` |
| `.getFormat()` | `.getData()` | `.getData()` |

Also:

- `setText()` no longer takes a `formatText` flag; strip markdown yourself.
- Node.js 22+ is required.
- v8's README described `.generateBeta()` as a fallback for `.generate()`. That was wrong — they return different things. See the table above.

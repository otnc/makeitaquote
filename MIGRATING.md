# Migrating

## From v9

No API changes — everything that worked in v9 still works the same way.
The breaking part is where downloaded fonts live by default.

### Font cache moved from a shared location to your project

v9 cached fonts in one place per machine: `$MIQ_FONT_CACHE_DIR`, else
`$XDG_CACHE_HOME`, else `%LOCALAPPDATA%` on Windows, else `~/.cache`. v10
defaults to `<project root>/.makeitaquote/fonts` instead — the nearest
ancestor directory with a `package.json`, found from `cwd`. A cache shared
by every project on the machine meant one project's `uninstall` could
reach into another's, and two projects pinned to different `makeitaquote`
versions could fight over the same files; a project-local cache can't.

- Nothing breaks: a font not found in the new location is simply
  re-downloaded on first use, same as any first run ever was.
- Add `.makeitaquote/` to `.gitignore`.
- CI configured to cache the old global directory should point it at
  `.makeitaquote/` (relative to the project) instead.
- To keep the old shared location, set `MIQ_FONT_CACHE_DIR` yourself —
  it's read exactly as it was in v9, and still wins over the new default.

Twemoji images follow the same rule, at `<project root>/.makeitaquote/twemoji`
(override with `MIQ_TWEMOJI_CACHE_DIR`) — new in v10, so there's nothing
of yours to move.

### New: an offline CLI

`npm i makeitaquote` now installs `miq`/`makeitaquote` as a command:

```console
$ npx miq install       # fonts + Twemoji, ahead of time
$ npx miq generate --text "Hello" --out quote.png
```

See the [Offline use](README.md#offline-use) section of the README for
the full command list (`install`, `uninstall`, `ls`, `search`, `outdated`,
`update`, `prune`, `env`, `generate`). Entirely additive — nothing to
migrate if you don't use it.

### New exports

`installTwemoji`, `uninstallTwemoji`, `twemojiInfo`, `resolveTwemojiDir`,
`installFont`, `installFonts`, `listInstalledFonts` and `uninstallFonts`
are now exported from the package root, alongside the existing
`resolveCacheDir`. `listInstalledFonts()`'s return type also gained a
`version` field (the cached Google Fonts asset tag) — only relevant if you
construct an `InstalledFont` object yourself rather than reading one back.

## From v8

v9 is a rewrite. The API changed, and images are now rendered locally by
default.

```diff
- const { MiQ } = require('makeitaquote')
+ const { MiQ } = require('makeitaquote')            // render locally
+ const { VoidsMiQ } = require('makeitaquote/api')   // keep using the API

  const buffer = await new MiQ()
      .setText(message.content)
-     .setDisplayname('音猫｡')
+     .setDisplayName('音猫｡')
-     .setColor(true)
+     .setTheme('color')
-     .generate(true)
+     .toBuffer('png')
```

| v8 | v9 (local) | v9 (API) |
| --- | --- | --- |
| `new MiQ()` | `new MiQ()` | `new VoidsMiQ()` |
| `.setDisplayname(v)` | `.setDisplayName(v)` | `.setDisplayName(v)` |
| `.setColor(true)` | `.setTheme('color')` | `.setColor(true)` |
| `.setText(v, true)` | `.setText(stripDiscordMarkdown(v))` | same |
| `.generate()` | — local rendering has no URL | `.toURL()` |
| `.generate(true)` | `.toBuffer('png')` | `.toBuffer({ hosted: true })` |
| `.generateBeta()` | `.toBuffer('png')` | `.toBuffer()` |
| `.getFormat()` | `.getData()` | `.getData()` |

Also:

- `setText()` no longer takes a `formatText` flag; strip markdown yourself.
- Node.js 22+ is required.
- v8's README described `.generateBeta()` as a fallback for `.generate()`. That
  was wrong — they return different things. See the table above.

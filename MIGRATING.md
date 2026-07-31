# Migrating from v8

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
| `.setText(v, true)` | `.setText(stripMarkdown(v))` | same |
| `.generate()` | — local rendering has no URL | `.toURL()` |
| `.generate(true)` | `.toBuffer('png')` | `.toBuffer({ hosted: true })` |
| `.generateBeta()` | `.toBuffer('png')` | `.toBuffer()` |
| `.getFormat()` | `.getData()` | `.getData()` |

Also:

- `setText()` no longer takes a `formatText` flag; strip markdown yourself.
- Node.js 22+ is required.
- v8's README described `.generateBeta()` as a fallback for `.generate()`. That
  was wrong — they return different things. See the table above.

# visual-check

Renders a curated set of option combinations to `docs/visual/`, the source for the [published gallery](https://otnc.github.io/makeitaquote/). Every case is also checked programmatically (decodable image, expected format/size), so this doubles as a smoke test.

```sh
npm run build          # reads dist/, so build first
npm run visual          # writes docs/visual/ and its manifest
npm run visual -- --offline           # skip anything needing the network
npm run visual -- --only theme,emoji  # only matching groups
```

## Layout

| File | What it does |
| --- | --- |
| `index.js` | Entry point — wires the pipeline together |
| `cli.js` | Parses `--offline`/`--out`/`--only` |
| `paths.js` | `root`, `assetsDir`, `outDir`, the parsed `cli` — computed once |
| `library.js` | Loads `dist/index.mjs` and the package version |
| `assets.js` | Loads `assets/*` and builds the `avatars` fixture |
| `fixtures.js` | Sample `text`, `who`, and the `base()`/`misskeyBase()` builders |
| `render.js` | Renders every selected case, checks the output, collects results |
| `manifest.js` | Writes `docs/visual/<group>/manifest.json` and the index |
| `report.js` | Console summary; exits non-zero on failure |
| `signatures.js` | Format sniffing (PNG/JPEG/WebP/AVIF) used by `render.js` |
| `cases/*.js` | One file per gallery group |

## Adding a case

Find the group file under `cases/` and add an entry to its `cases` array:

```js
{
  name: 'a short label for the card',
  build: () => base().setText(text.short).setAvatar(avatars.illustration),
}
```

- `name` is unique within the group and becomes the image filename.
- `build` returns a `MiQ`/`MiQChain` — nothing is rendered until `render.js` calls `.toBuffer()` on it.
- Optional fields: `note` (shown under the card), `network: true` (skipped by `--offline`), `format`/`encodeOptions` (default `'png'`), `expect: { width, height }` (asserted after render).
- A case earns its place only if it looks meaningfully different from its neighbours — near-duplicates belong in a unit test instead.

## Adding a group

1. Create `cases/NN-your-group.js` (the number just keeps output folders sorted on disk — it does not decide the gallery's display order):

   ```js
   import { avatars, base, text } from '../fixtures.js'

   export const group = 'NN-your-group'

   export const cases = [
     { name: '…', build: () => base().setText(text.short).setAvatar(avatars.illustration) },
   ]
   ```

2. Add it to `cases/index.js` — import it and insert it into the `caseModules` array wherever it reads best in the narrative (that array's order *is* the display order).

## Fixtures

- `fixtures.js` re-exports `avatars`/`required` from `assets.js`, so most case files only need one import: `import { avatars, base, text } from '../fixtures.js'`.
- Need the library itself (`MiQ`, `MiQChain`, `FONT_CATALOGUE`, …)? `import { MiQ } from '../library.js'`.
- Text samples are published, so keep them things a person might plausibly have said out of context — public domain prose or neutral statements about the library, nothing that reads as a real quotation from a real person.

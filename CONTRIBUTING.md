# Contributing

Thanks for taking a look.

## Getting set up

```sh
npm install
npm run test
```

Node.js 22 or newer is required.

## Commands

| Command | What it does |
| --- | --- |
| `npm run test` | Runs the test suite |
| `npm run test:watch` | Same, in watch mode |
| `npm run test:coverage` | Test suite with a coverage report |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Biome lint + format, writing fixes |
| `npm run ci` | Biome in check-only mode, as CI runs it |
| `npm run build` | Builds `dist/` with tsdown |
| `npm run check:build` | Verifies the build output (see below) |
| `npm run visual` | Renders every option combination to `docs/visual/` |

Before opening a PR, `npm run ci && npm run typecheck && npm run test` should
all pass. If you touched exports, entry points or dependencies, also run
`npm run build && npm run check:build`.

## How the code is organised

```
src/
├─ core/     the MiQ builder, input validation, Discord message parsing
├─ text/     segmentation, line breaking, auto-fit, drawing
├─ emoji/    Twemoji and Discord emoji fetching and caching
├─ font/     registration, on-demand downloading, the disk cache
├─ theme/    presets and merging
├─ render/   the drawing pipeline
├─ output/   encoding
└─ api/      the Voids API client
```

Two structural rules are worth knowing about:

**`src/render/canvasFactory.ts` is the only place `@napi-rs/canvas` is
imported.** That keeps the native binding out of the `makeitaquote/api` entry
point, so the API client works on platforms with no prebuilt binary.
`check-build.js` enforces this both statically and by loading the built entry
and looking at what it pulled in.

**`ky` is ESM-only**, so tsdown inlines it into the CJS build
(`deps.alwaysBundle`). If you add an ESM-only dependency, it needs the same
treatment or `require('makeitaquote')` breaks.

## Tests

Tests sit next to the code as `*.test.ts`.

Rendering output isn't compared pixel by pixel — font versions, OS and Skia
updates all move those pixels, and a suite that fails for those reasons stops
being useful. Instead the layout logic is tested as pure functions with an
injected measurer, and the pipeline gets smoke tests that check the image is
valid, the right size, and the right color in specific places.

Nothing in the test suite touches the network. The emoji and font layers take
an injectable fetcher for exactly this reason.

### Looking at the output

`npm run visual` renders every theme, avatar source, text case, emoji case,
canvas size and output format using the images in `assets/`, then writes a
gallery under `docs/visual/`. Open `docs/index.html` to see the whole
surface of the library at once.

It also checks each case programmatically — the bytes have to decode as the
requested format and come out at the expected size — so it exits non-zero if
anything broke, and the failing cards are outlined in red.

```sh
npm run build && npm run visual
npm run visual -- --offline           # skip cases that need the network
npm run visual -- --only theme,emoji  # only matching groups
```

This is the right way to check a change that affects how images look. Please
attach before/after images from it on any PR that moves pixels.

Committing the regenerated gallery is optional — `release.yml`'s `gallery`
job redoes the whole thing on `main` after every release either way. If you
do commit it, the manifest is split one file per group
(`docs/visual/<group>/manifest.json`, plus a small index) precisely so two
branches touching different groups touch different files and never collide.
Nothing in a group's file changes between runs unless its images did.

## Dependencies

There is no Dependabot here; updates are done by hand. Before a release, run
`npm outdated` and `npm audit` and deal with anything that turns up.

A dependency is worth it when it owns a specification this package does not,
or when it is simply smaller than the code it deletes. `mfm-js` is Misskey's
own MFM parser and `color` is the CSS colour syntax — both moving targets a
local regex only approximates, and both replaced code that had already been
wrong once. `quick-lru` replaced 89 lines outright.

What has been turned down, and why, so it need not be re-litigated:

| Candidate | Why not |
| --- | --- |
| `lru-cache` | 2.8MB, against `quick-lru`'s 36K for the same job. |
| `env-paths` | Returns different paths from the ones README documents, so upgrading would orphan every existing font cache. |
| `css-tree` / `postcss` | 1.9MB / 327K to read three fields out of one API's machine-generated `@font-face` blocks. |
| `discord-markdown`, `simple-markdown` | Last published 2021; pull in `highlight.js` and `@types/react`. |

**An ESM-only dependency must go in `deps.alwaysBundle`** in
`tsdown.config.ts`, or the CJS build emits a `require()` of it and throws for
anyone using `require('makeitaquote')`. `check-build.js` works out which
dependencies those are from their own `package.json` and fails if one is
left external, so this is caught rather than remembered.

## Releasing

Maintainers only. Run the `release` workflow from the Actions tab and give it a
version bump (`patch`, `minor`, `major`) or an explicit version.

The workflow runs the full check suite, publishes to npm via trusted publishing
(OIDC — there is no `NPM_TOKEN`), then tags and creates the GitHub release.

Publishing requires the trusted publisher to be configured once on npmjs.com:
package Settings → Publishing access → Trusted publishers → GitHub, pointing at
`otnc/makeitaquote` and `release.yml`.

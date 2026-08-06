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

**Every runtime dependency must ship a real CJS build** — a `require` export
condition, not just a bare `"type": "module"` package `require()` would throw
on. `deps.alwaysBundle` in `tsdown.config.ts` is the escape hatch for one that
doesn't, but it sits empty on purpose: an ESM-only package is, all else
equal, passed over for one that isn't (see the dependency table below).
`check-build.js` works out which installed dependencies are ESM-only from
their own `package.json` and fails the build if one is left unbundled, so
this is caught rather than remembered.

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
own MFM parser, `discomd` is Discord's own Markdown dialect, `markdown-it` is
a CommonMark/GFM parser and `culori` is the CSS colour syntax — all four
moving targets a local regex only approximates, and all four replaced code
that had already been wrong once. `tiny-lru` replaced 89 lines outright, and
`ofetch` owns retry/timeout/backoff for the same reason a hand-rolled version
of that was wrong once too.

`discomd` disagrees with this package's own prior implementation in two
narrow, accepted ways: a backslash escape resolves even inside a code span
(Discord's client leaves it literal there), and an intraword underscore
(`snake_case_var`) is read as italic rather than left alone. Both are pinned
in `discordMarkdown.test.ts` rather than worked around, and reported upstream
([discomd#2](https://github.com/otnc/discomd/issues/2),
[discomd#3](https://github.com/otnc/discomd/issues/3), both fixed by 1.0.1)
for the two that were genuine bugs rather than accepted differences.

`markdown-it` was picked over the `remark`/`mdast` ecosystem for the same
job — 1.7MB and 45 packages for `remark` + `strip-markdown`, or 1.0MB and 28
for `mdast-util-from-markdown` + `mdast-util-to-string`, against
`markdown-it`'s ~2MB across 7 packages, but a real dual CJS/ESM build where
the other two are ESM-only. `stripMarkdown()` first reshapes `markdown-it`'s
flat, SAX-like token stream (an `_open` token, a later matching `_close`,
everything between the two its content) into the same kind of tree
`stripMfm()` already walks for MFM, then walks that — see the comment on
`toTree()`. Blank-line fidelity between blocks comes from each token's own
source line range (`.map`) rather than a dedicated separator token, since
`markdown-it` doesn't hand back one the way the library used here previously
did.

`culori` was picked over `chroma-js` (both are real, actively maintained CSS
Color 4 parsers with a genuine dual build) mostly on how the API mapped onto
this package's own `parseColor()`/`RGBA` shape; either would have worked.
`colord` was passed over despite being smaller than both — no release since
2022, which reads as finished rather than actively maintained, and this
package leans toward the latter when a dependency owns an evolving spec.
Switching to `culori` was a genuine capability gain, not just a like-for-like
swap: `lab()`, `lch()`, `oklab()`, `oklch()` and `color()` all parse now,
none of which the package this replaced supported.

Every one of `ky`, `color`, `quick-lru` and `marked` was, at one point,
exactly what this table would have recommended — and every one was
ESM-only, which eventually meant `deps.alwaysBundle` inlining four
dependencies into the CJS build just to keep `require('makeitaquote')`
working. Each was swapped for a library doing the same job with a real dual
CJS/ESM build — `ofetch`, `culori`, `tiny-lru`, `markdown-it` — rather than
dropped, so this is a like-for-like set of replacements, not a reduction in
what the package depends on.

What has been turned down, and why, so it need not be re-litigated:

| Candidate | Why not |
| --- | --- |
| `lru-cache` | 2.8MB, against `tiny-lru`'s 58K for the same job. |
| `env-paths` | Returns different paths from the ones README documents, so upgrading would orphan every existing font cache. |
| `css-tree` / `postcss` | 1.9MB / 327K to read three fields out of one API's machine-generated `@font-face` blocks. |
| `discord-markdown`, `simple-markdown` | Last published 2021; pull in `highlight.js` and `@types/react`. |
| `remove-markdown` | Regex-based, not a real parser, for either use it was considered for. Against Discord's dialect it reads `__x__` as bold instead of underline and strips the URL out of `[text](url)`, which `stripDiscordMarkdown()` deliberately leaves alone. For plain CommonMark it is 9K against `markdown-it`'s ~2MB, but its own README lists "make the rules more robust, support more edge cases" as a TODO — correctness `stripMarkdown()` gets from `markdown-it` actually being a parser. |
| `remark` + `strip-markdown`, `mdast-util-from-markdown` + `mdast-util-to-string` | Real CommonMark compliance, but 1.7MB/45 packages and 1.0MB/28 packages respectively, and both ESM-only — `markdown-it` gets the same compliance with a real CJS build. |
| `axios` | Dual CJS/ESM and would have solved the same problem `ofetch` does, but ruled out on request rather than technical grounds. |
| `colord` | See above — no release since 2022. |

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

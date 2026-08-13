# Info

Background that doesn't belong in [CONTRIBUTING.md](CONTRIBUTING.md) — not
things you need to know to send a PR, but the reasoning behind decisions
already made, kept here so they don't get re-litigated or silently drift out
of date in a comment somewhere.

## Dependencies

**The bar: every runtime dependency must ship a real CJS build** — a
`require` export condition, not just a bare `"type": "module"` package
`require()` would throw on. All else equal, an ESM-only package is passed
over for one that isn't, and `check-build.js` fails the build if one slips
in anyway (see `tsdown.config.ts`'s `deps.alwaysBundle`, which sits empty on
purpose). That's the standing requirement; nothing else about a candidate
disqualifies it on its own.

Owning a specification this package doesn't, or being smaller than the code
it deletes, is *why* each existing dependency in particular got added —
not a requirement the next one has to clear too. `mfm-js` is Misskey's own
MFM parser, `discomd` is Discord's own Markdown dialect, `markdown-it` is a
CommonMark/GFM parser and `culori` is the CSS colour syntax — all four
moving targets a local regex only approximates, and all four replaced code
that had already been wrong once. `tiny-lru` replaced 89 lines outright, and
`ofetch` owns retry/timeout/backoff for the same reason a hand-rolled version
of that was wrong once too.

### discomd

Disagrees with this package's own prior implementation in two narrow,
accepted ways: a backslash escape resolves even inside a code span
(Discord's client leaves it literal there), and an intraword underscore
(`snake_case_var`) is read as italic rather than left alone. Both are pinned
in `discordMarkdown.test.ts` rather than worked around, and reported
upstream ([discomd#2](https://github.com/otnc/discomd/issues/2),
[discomd#3](https://github.com/otnc/discomd/issues/3), both fixed by 1.0.1)
for the two that were genuine bugs rather than accepted differences.

### markdown-it

Picked over the `remark`/`mdast` ecosystem for the same job — 1.7MB and 45
packages for `remark` + `strip-markdown`, or 1.0MB and 28 for
`mdast-util-from-markdown` + `mdast-util-to-string`, against `markdown-it`'s
~2MB across 7 packages, but a real dual CJS/ESM build where the other two
are ESM-only.

`stripMarkdown()` first reshapes `markdown-it`'s flat, SAX-like token stream
(an `_open` token, a later matching `_close`, everything between the two its
content) into the same kind of tree `stripMfm()` already walks for MFM, then
walks that — see `toTree()` in `src/text/markdown.ts`. Blank-line fidelity
between blocks comes from each token's own source line range (`.map`) rather
than a dedicated separator token, since `markdown-it` doesn't hand back one
the way the library used here previously did.

### culori

Picked over `chroma-js` (both are real, actively maintained CSS Color 4
parsers with a genuine dual build) mostly on how the API mapped onto this
package's own `parseColor()`/`RGBA` shape; either would have worked. `colord`
was passed over despite being smaller than both — no release since 2022,
which read as finished rather than actively maintained at the time. That was
a judgment call for this specific pick, not a standing rule against
unmaintained packages.

Switching to `culori` was a genuine capability gain, not just a
like-for-like swap: `lab()`, `lch()`, `oklab()`, `oklch()` and `color()` all
parse now, none of which the package this replaced supported.

### X (Twitter)

`setFromTweet()` takes zero dependencies, the same as `setFromMessage()`/
`setFromNote()` — but unlike either, its adapters (`fromFxTwitterStatus()`,
`fromTwitterApiV2Tweet()`) don't get to be the identity function, since
neither of X's two practical APIs returns something `TweetLike` (this
package's own shape) accepts unchanged: the official API v2 splits a tweet
from its author entirely (`author_id`, resolved through a separate
`includes.users` array), and FxTwitter spells the same fields differently
(`screen_name`, `avatar_url`).

`twitter-api-v2` and `fxtwitter` were each picked as *the* reference shape
each adapter targets — actively maintained, typed, and (per this package's
own CJS/ESM policy) real dual builds — but neither ships as an actual
dependency, runtime or dev. Both adapters take a structural subset of the
real response shape instead, the same reasoning `MessageLike` is
dependency-free despite matching discord.js: an object with the right fields
works whether or not the library that produced it is installed, and neither
library's own code ever has to run inside this one.

### The ESM-only generation

Every one of `ky`, `color`, `quick-lru` and `marked` was, at one point,
exactly what this page would have recommended — and every one was ESM-only,
which eventually meant `deps.alwaysBundle` inlining four dependencies into
the CJS build just to keep `require('makeitaquote')` working. Each was
swapped for a library doing the same job with a real dual CJS/ESM build —
`ofetch`, `culori`, `tiny-lru`, `markdown-it` — rather than dropped, so this
was a like-for-like set of replacements, not a reduction in what the package
depends on.

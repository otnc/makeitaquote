# Third-party notices

`makeitaquote` itself is MIT licensed — see [LICENSE](LICENSE). This file covers
the third-party code it depends on, and the third-party assets it fetches at
runtime.

## Runtime dependencies

| Package | Licence |
| --- | --- |
| [`@napi-rs/canvas`](https://github.com/Brooooooklyn/canvas) | MIT |
| [`@twemoji/parser`](https://github.com/jdecked/twemoji) | MIT |
| [`budoux`](https://github.com/google/budoux) | Apache-2.0 |
| [`culori`](https://github.com/Evercoder/culori) | MIT |
| [`discomd`](https://github.com/otnc/discomd) | MIT |
| [`markdown-it`](https://github.com/markdown-it/markdown-it) | MIT |
| [`mfm-js`](https://github.com/misskey-dev/mfm.js) | MIT |
| [`ofetch`](https://github.com/unjs/ofetch) | MIT |
| [`tiny-lru`](https://github.com/avoidwork/tiny-lru) | BSD-3-Clause |

Their licence texts are installed alongside them in `node_modules`, and are
included in any bundle that redistributes them.

## Assets fetched at runtime

This package downloads images and fonts while rendering. They are **not**
redistributed as part of the package — they are fetched by the machine running
it, and cached there.

### Twemoji — CC-BY 4.0 (attribution required)

Standard Unicode emoji are drawn using [Twemoji](https://github.com/jdecked/twemoji)
graphics, fetched from jsDelivr.

> Copyright 2019 Twitter, Inc and other contributors.
> Graphics licensed under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**CC-BY 4.0 requires attribution.** The Twemoji project accepts a mention in a
README, an "About" section, or a footer. If you publish images produced by this
package, you should carry that attribution somewhere in your project — this
notice, or a line such as:

> Emoji graphics by [Twemoji](https://github.com/jdecked/twemoji), licensed
> under CC-BY 4.0.

To avoid the requirement entirely, disable emoji images: text containing emoji
still renders, using whatever the system font provides.

### Google Fonts — OFL 1.1 / Apache-2.0 / UFL 1.0

Fonts are resolved and fetched through the
[Google Fonts API](https://fonts.google.com). Google Fonts distributes only
fonts under the SIL Open Font License 1.1, Apache License 2.0, or the Ubuntu
Font Licence 1.0 — all of which permit embedding font output in images without
restriction.

This package **only** fetches fonts from Google Fonts. It will not download a
font from anywhere else by name, which is why families that are paid, or whose
licence is unclear, are rejected rather than sourced elsewhere.

The default family is [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)
(SIL Open Font License 1.1).

Fonts you register yourself, with `fonts.registerFromPath()` or
`fonts.registerFromURL()`, are entirely your responsibility — this package
places no restriction on them and performs no check.

> Rendering text with a font produces an image, not a copy of the font. Every
> licence above permits that. Redistributing the font *file* is a separate
> question, and the on-disk cache this package writes is a local copy for its
> own use rather than redistribution.

### Discord and Misskey custom emoji

Custom emoji are fetched from Discord's CDN and from Misskey instances. They are
user-uploaded content, owned by whoever uploaded them, and carry no blanket
licence. Quoting a message that contains them is your call, under whatever terms
apply to that content.

## Attribution summary

If you publish images this package produces, the one thing you are actually
obliged to carry is the Twemoji attribution. The simplest form:

> Emoji graphics by [Twemoji](https://github.com/jdecked/twemoji) (CC-BY 4.0).

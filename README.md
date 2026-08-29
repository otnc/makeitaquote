# Make it a Quote
Generate a quote.<br>
A quote image generator for Discord.<br>
Powered by [Voids API](https://voids.top/).

> Note: The Voids API is not owned or operated by the developer of this package, so please do not contact us through GitHub Issues or other such inquiries about the API being down.

###### Teams
<a href="https://oto.pet/"><img src="https://www.otoneko.cat/img/logo.png" alt="OTONEKO.CAT" style="display: block; width: auto; height: 100px;"/></a>
<a href="https://www.otoho.me/"><img src="https://www.otoho.me/img/logo.png" alt="Oto Home" style="display: block; width: auto; height: 100px;"/></a>

## Example
Code (CommonJS): [miq.cjs](https://github.com/otnc/makeitaquote/tree/legacy/examples/miq.cjs)<br>
Code (ESM): [miq.mjs](https://github.com/otnc/makeitaquote/tree/legacy/examples/miq.mjs)<br>
With discord.js: [miq-with-discordjs.md](https://github.com/otnc/makeitaquote/tree/legacy/examples/miq-with-discordjs.md)


> Note: If an API issue prevents you from using .generate(), you can use .generateBeta()

With discord.js(beta): [beta-with-discordjs.md](https://github.com/otnc/makeitaquote/tree/legacy/examples/beta-with-discordjs.md)

![MiQ](assets/readme/MiQ.png)
![MiQ Color](assets/readme/MiQ-color.png)

## Development
This branch (`legacy`) is a long-term maintenance line for the legacy `axios`/`displus`-based
implementation and is published under the npm `legacy` dist-tag; it is never merged into `main`.

```
npm install
npm run build
npm run ci        # biome
npm run typecheck
npm run test       # vitest, with axios mocked — no network calls
```

`examples/miq.cjs` and `examples/miq.mjs` call the live Voids API and are not run in CI. Build
first, then run them locally against the real API as a manual check before releasing:

```
npm run build
node examples/miq.cjs
node examples/miq.mjs
```

## Get Support
<a href="https://discord.gg/yKW8wWKCnS"><img src="https://discordapp.com/api/guilds/1005287561582878800/widget.png?style=banner4" alt="Discord Banner"/></a>

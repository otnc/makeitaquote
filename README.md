# Make it a Quote

Generate a quote.

A quote image generator for Discord.  
Powered by [Voids API](https://voids.top/).

> [!Note]
>   
> The Voids API is not owned or operated by the developer of this package, so please do not contact us through GitHub Issues or other such inquiries about the API being down.

> [!Important]
>   
> This `legacy` branch is maintenance-only — it exists so `makeitaquote@legacy` keeps working for whoever already depends on it, but does not receive new features. For active development, this exact "call a hosted API for a quote image" idea now lives in two maintained packages instead: [`@makeitaquote/voids`](https://github.com/otnc/makeitaquote-voids) (the same Voids API this branch talks to) or [`@makeitaquote/miqx`](https://github.com/otnc/makeitaquote-miqx) (the MiqX API). If you'd rather render locally with no external API at all, see [`makeitaquote`](https://github.com/otnc/makeitaquote) (the `main`/`release/v12` line).
> ```bash
> npm install @makeitaquote/voids
> # or
> npm install @makeitaquote/miqx
> ```

## Example

Code (CommonJS): [miq.cjs](https://github.com/otnc/makeitaquote/tree/legacy/examples/miq.cjs)  
Code (ESM): [miq.mjs](https://github.com/otnc/makeitaquote/tree/legacy/examples/miq.mjs)  
With discord.js: [miq-with-discordjs.md](https://github.com/otnc/makeitaquote/tree/legacy/examples/miq-with-discordjs.md)

> [!Note]
>   
> If an API issue prevents you from using .generate(), you can use .generateBeta()

With discord.js(beta): [beta-with-discordjs.md](https://github.com/otnc/makeitaquote/tree/legacy/examples/beta-with-discordjs.md)

![Sample quote image, default dark theme](assets/readme/mono.png)  
![Sample quote image, color theme](assets/readme/color.png)

## Development

This branch (`legacy`) is a long-term maintenance line for the legacy `axios`/`discomd`-based implementation and is published under the npm `legacy` dist-tag; it is never merged into `main`.

```bash
npm install
npm run build
npm run ci        # biome
npm run typecheck
npm run test       # vitest, with axios mocked — no network calls
```

`examples/miq.cjs` and `examples/miq.mjs` call the live Voids API and are not run in CI. Build first, then run them locally against the real API as a manual check before releasing:

```bash
npm run build
node examples/miq.cjs
node examples/miq.mjs
```

## Licence

ISC — see [LICENSE](LICENSE).

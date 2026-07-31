import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/api/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // Node >= 22 supports ES2024
  target: 'node22',
  platform: 'node',
  deps: {
    // ky is ESM-only; inline it so the CJS build doesn't `require()` an ESM package.
    alwaysBundle: ['ky'],
    // Native bindings must stay as imports — a bundled .node file won't load.
    neverBundle: ['@napi-rs/canvas', '@twemoji/parser', 'budoux'],
  },
})

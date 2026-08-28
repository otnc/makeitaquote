import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/api/index.ts', 'src/cli/main.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // Node >= 22 supports ES2024
  target: 'node22',
  platform: 'node',
  minify: true,
  deps: {
    // Every runtime dependency ships a real CJS build (a `require` export
    // condition, not just a `"type": "module"` package `require()` would
    // throw on) — see INFO.md for why each one was picked partly for that.
    // Nothing needs `alwaysBundle`, and `check-build.js` fails the build the
    // day that stops being true.
    //
    // Native bindings must stay as imports — a bundled .node file won't load.
    neverBundle: ['@napi-rs/canvas', '@twemoji/parser', 'budoux'],
  },
})

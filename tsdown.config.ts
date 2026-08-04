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
    // All ESM-only ("type": "module" with no CJS entry), so inline them or
    // the CJS build ends up with a `require()` of an ESM package, which
    // throws ERR_REQUIRE_ESM the moment anyone calls into it.
    alwaysBundle: ['ky', 'color', 'quick-lru', 'marked'],
    // Native bindings must stay as imports — a bundled .node file won't load.
    neverBundle: ['@napi-rs/canvas', '@twemoji/parser', 'budoux'],
  },
})

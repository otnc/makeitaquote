import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // No native bindings and no bleeding-edge syntax needed here, so this
  // branch keeps a broader Node floor than main's node22 target.
  target: 'node18',
  platform: 'node',
})

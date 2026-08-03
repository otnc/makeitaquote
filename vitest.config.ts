import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Several suites load the @napi-rs/canvas native binding. Several forked
    // workers doing that at once has been observed to crash a worker on the
    // macos-latest runner ("Worker exited unexpectedly") even though the
    // exact same commit had just passed on the PR run — one process at a
    // time avoids the race, and the whole suite still runs in a few seconds.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__fixtures__/**'],
    },
  },
})

#!/usr/bin/env node
// Verifies the build output before it can be published.
//
// Run with: npm run check:build  (after `npm run build`)
//
// vitest only looks at `src/**`, so the guarantees that depend on `dist/`
// living up to what package.json promises are checked here instead.
// No dependencies — Node >= 22 built-ins only.

import { readFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dist = join(root, 'dist')
const require = createRequire(join(root, 'package.json'))

/** Deps that must never be reachable from the `makeitaquote/api` entry. */
const RENDERING_DEPS = ['@napi-rs/canvas', 'budoux', '@twemoji/parser']

const failures = []
let checks = 0

function check(label, condition, detail) {
  checks++
  if (condition) return
  failures.push(detail ? `${label}\n      ${detail}` : label)
}

function name(file) {
  return relative(dist, file).replaceAll('\\', '/')
}

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else out.push(full)
  }
  return out
}

/**
 * Every dist file an entry point can reach, following relative imports.
 *
 * tsdown emits shared chunks, so checking the entry file alone would miss a
 * dependency that arrived one hop away.
 */
async function reachableFrom(entry) {
  const seen = new Set()
  const queue = [entry]

  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)

    const source = await readFile(file, 'utf8')
    const specifiers = [
      ...source.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g),
      ...source.matchAll(/from\s*['"](\.[^'"]+)['"]/g),
      ...source.matchAll(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g),
    ].map((match) => match[1])

    for (const specifier of specifiers) {
      queue.push(resolve(dirname(file), specifier))
    }
  }

  return seen
}

const files = await walk(dist)
const present = files.map(name)

// ---------------------------------------------------------------------------
// 1. Every path package.json advertises actually exists.
// ---------------------------------------------------------------------------

for (const expected of [
  'index.mjs',
  'index.cjs',
  'index.d.mts',
  'index.d.cts',
  'api/index.mjs',
  'api/index.cjs',
  'api/index.d.mts',
  'api/index.d.cts',
]) {
  check(`dist/${expected} exists`, present.includes(expected))
}

// ---------------------------------------------------------------------------
// 2. Both module systems can load both entry points.
// ---------------------------------------------------------------------------

const cjsRoot = require('./dist/index.cjs')
check('dist/index.cjs exports MiQ', typeof cjsRoot.MiQ === 'function')
check('dist/index.cjs exports fonts', typeof cjsRoot.fonts === 'object')

const esmRoot = await import(pathToFileURL(join(dist, 'index.mjs')).href)
check('dist/index.mjs exports MiQ', typeof esmRoot.MiQ === 'function')

const esmApi = await import(pathToFileURL(join(dist, 'api', 'index.mjs')).href)
check('dist/api/index.mjs exports VoidsMiQ', typeof esmApi.VoidsMiQ === 'function')
check('dist/api/index.mjs aliases it as MiQ', typeof esmApi.MiQ === 'function')

// ---------------------------------------------------------------------------
// 3. Requiring the api entry must not load the native canvas binding.
//
//    This is the guarantee that lets someone use `makeitaquote/api` on a
//    platform @napi-rs/canvas has no binary for. Checked by loading it in a
//    clean cache and looking at what arrived. See DESIGN.md 4.2.
// ---------------------------------------------------------------------------

for (const key of Object.keys(require.cache)) delete require.cache[key]

const cjsApi = require('./dist/api/index.cjs')
check('dist/api/index.cjs exports VoidsMiQ', typeof cjsApi.VoidsMiQ === 'function')

const loadedModules = Object.keys(require.cache)
  .filter((path) => path.includes('node_modules'))
  .map((path) => path.split('node_modules').pop().replaceAll('\\', '/'))

for (const dep of RENDERING_DEPS) {
  check(
    `requiring makeitaquote/api does not load ${dep}`,
    !loadedModules.some((module) => module.includes(dep)),
    `Loaded: ${loadedModules.join(', ') || '(nothing)'}`,
  )
}

// ---------------------------------------------------------------------------
// 4. The same guarantee, statically: no chunk the api entry can reach may
//    mention the rendering stack.
// ---------------------------------------------------------------------------

for (const entry of ['api/index.cjs', 'api/index.mjs']) {
  const reachable = await reachableFrom(join(dist, entry))
  for (const file of reachable) {
    const source = await readFile(file, 'utf8')
    for (const dep of RENDERING_DEPS) {
      check(
        `${entry} → dist/${name(file)} does not reference ${dep}`,
        !source.includes(dep),
        'The api subpath must not pull in the rendering stack.',
      )
    }
  }
}

// ---------------------------------------------------------------------------
// 5. An ESM-only dependency must be inlined, never require()d from the CJS
//    output — `require()` of one throws the moment anything calls into it.
//
//    Which dependencies those are is worked out from their own package.json
//    rather than listed here, so a new one is caught the day it is installed
//    instead of the day someone remembers to add it.
// ---------------------------------------------------------------------------

/** True when a package publishes ESM only, with no CJS entry to fall back to. */
function isEsmOnly(dependency) {
  let manifest
  try {
    manifest = require(`${dependency}/package.json`)
  } catch {
    // Not every package exports its own package.json. Read it off disk.
    try {
      const path = join(root, 'node_modules', dependency, 'package.json')
      manifest = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      return false
    }
  }

  if (manifest.type !== 'module') return false

  // `exports` may still offer a `require` condition, which makes it dual.
  const exported = JSON.stringify(manifest.exports ?? '')
  return !exported.includes('"require"') && !manifest.main?.endsWith('.cjs')
}

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const esmOnly = Object.keys(manifest.dependencies ?? {}).filter(isEsmOnly)
check('found the ESM-only dependencies to police', esmOnly.length > 0, 'expected at least ky')

for (const file of files.filter((f) => f.endsWith('.cjs'))) {
  for (const dependency of esmOnly) {
    check(
      `dist/${name(file)} does not require('${dependency}')`,
      !new RegExp(`require\\(\\s*['"]${dependency}['"]\\s*\\)`).test(await readFile(file, 'utf8')),
      `${dependency} is ESM-only; tsdown's deps.alwaysBundle must inline it.`,
    )
  }
}

// ---------------------------------------------------------------------------
// 6. The native binding must stay external — a bundled .node file won't load.
// ---------------------------------------------------------------------------

const rootCjs = await readFile(join(dist, 'index.cjs'), 'utf8')
const rootMjs = await readFile(join(dist, 'index.mjs'), 'utf8')
check(
  'dist/index.cjs keeps @napi-rs/canvas external',
  /require\(\s*['"]@napi-rs\/canvas['"]\s*\)/.test(rootCjs),
)
check(
  'dist/index.mjs keeps @napi-rs/canvas external',
  /from\s*['"]@napi-rs\/canvas['"]/.test(rootMjs),
)

// ---------------------------------------------------------------------------
// 7. Line endings stay LF, matching .gitattributes and Biome.
// ---------------------------------------------------------------------------

for (const file of files) {
  if (!/\.(mjs|cjs|mts|cts|ts|map)$/.test(file)) continue
  const source = await readFile(file, 'utf8')
  check(`dist/${name(file)} has no CRLF`, !source.includes('\r\n'))
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`check-build: ${failures.length} of ${checks} checks failed\n`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}

console.log(`check-build: all ${checks} checks passed`)

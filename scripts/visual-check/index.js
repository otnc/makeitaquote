#!/usr/bin/env node
// Renders a curated set of option combinations and builds a contact sheet, so
// the visible behaviour of the library can be eyeballed in one page.
//
//   npm run build          # visual-check reads dist/, so build first
//   npm run visual         # writes docs/visual/ and its manifest
//   npm run visual -- --offline           # skip anything needing the network
//   npm run visual -- --only theme,emoji  # only matching groups
//
// Split across this directory rather than one long file: cases/ holds one
// module per gallery group — adding a new group means adding one file there
// and one line in cases/index.js, not scrolling a thousand-line script to
// find the right spot. Everything else here is one stage of the pipeline:
// parse the CLI, load the built package and fixture assets, register every
// case, render, write the manifests, report.
//
// Every case is also checked programmatically: it has to produce a decodable
// image of the expected format and size. Failures are listed in the console and
// highlighted in the page, so this doubles as a smoke test over the public API.
//
// No dependencies — Node >= 22 built-ins plus the built package.

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadAssets } from './assets.js'
import { caseGroups } from './cases/index.js'
import { parseCli } from './cli.js'
import { buildFixtures } from './fixtures.js'
import { loadPackage } from './loadPackage.js'
import { writeManifests } from './manifest.js'
import { renderCases } from './render.js'
import { report } from './report.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')
const assetsDir = join(root, 'assets')

const cli = parseCli()
const outDir = join(root, cli.out)

const { pkg, packageVersion } = await loadPackage(root)
const {
  MiQ,
  MiQChain,
  FONT_CATALOGUE,
  COLOR_THEME_CATALOGUE,
  CUSTOM_COLOR_THEME_CATALOGUE,
  colorThemeGradient,
  colorThemeTextBase,
  stripMarkdown,
} = pkg

const { required, discordEmoji, misskeyEmoji, avatars } = await loadAssets(assetsDir)
const { text, who, base, misskeyBase } = buildFixtures({ MiQ, discordEmoji, misskeyEmoji })

// ---------------------------------------------------------------------------
// Cases
//
// Each group is a folder in the output. Keep them short: a case earns its
// place only if it looks meaningfully different from the others in its group.
// ---------------------------------------------------------------------------

const cases = []

function add(group, name, build, extra = {}) {
  cases.push({ group, name, build, ...extra })
}

const ctx = {
  MiQ,
  MiQChain,
  FONT_CATALOGUE,
  COLOR_THEME_CATALOGUE,
  CUSTOM_COLOR_THEME_CATALOGUE,
  colorThemeGradient,
  colorThemeTextBase,
  stripMarkdown,
  required,
  discordEmoji,
  misskeyEmoji,
  avatars,
  text,
  who,
  base,
  misskeyBase,
}

for (const register of caseGroups) register(add, ctx)

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const { allGroups, groupsToRender, results, elapsed } = await renderCases(cases, {
  offline: cli.offline,
  only: cli.only,
  outDir,
})

await writeManifests({ outDir, allGroups, groupsToRender, results, packageVersion })

report({ outDir, root, results, elapsed })

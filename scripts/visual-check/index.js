#!/usr/bin/env node
// Renders a curated set of option combinations and builds a contact sheet, so
// the visible behaviour of the library can be eyeballed in one page.
//
//   npm run build          # visual-check reads dist/, so build first
//   npm run visual         # writes docs/visual/ and its manifest
//   npm run visual -- --offline           # skip anything needing the network
//   npm run visual -- --only theme,emoji  # only matching groups
//
// See README.md in this directory for how to add a case or a group.

import { caseModules } from './cases/index.js'
import { packageVersion } from './library.js'
import { writeManifests } from './manifest.js'
import { cli, outDir, root } from './paths.js'
import { renderCases } from './render.js'
import { report } from './report.js'

const cases = caseModules.flatMap((mod) => mod.cases.map((c) => ({ group: mod.group, ...c })))

const { allGroups, groupsToRender, results, elapsed } = await renderCases(cases, {
  offline: cli.offline,
  only: cli.only,
  outDir,
})

await writeManifests({ outDir, allGroups, groupsToRender, results, packageVersion })

report({ outDir, root, results, elapsed })

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Turns `01-themes` into `Themes`, for the gallery headings. */
export function titleOf(group) {
  return group
    .replace(/^\d+-/, '')
    .replace(/-/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

// One file per group (docs/visual/<group>/manifest.json) plus a small index (docs/visual/manifest.json) listing which groups exist — so two PRs touching different groups touch different files, never a shared one.
export async function writeManifests({
  outDir,
  allGroups,
  groupsToRender,
  results,
  packageVersion,
}) {
  for (const group of groupsToRender) {
    const groupManifest = {
      name: group,
      title: titleOf(group),
      cases: results
        .filter((result) => result.group === group)
        .map((result) => ({
          name: result.name,
          file: result.file,
          note: result.note ?? null,
          format: result.format,
          width: result.size?.width ?? null,
          height: result.size?.height ?? null,
          bytes: result.bytes ?? null,
          ok: result.problems.length === 0,
          error: result.error ?? (result.problems.length > 0 ? result.problems.join('; ') : null),
        })),
    }

    await writeFile(
      join(outDir, group, 'manifest.json'),
      `${JSON.stringify(groupManifest, null, 2)}\n`,
    )
  }

  // The index lists every group, not just the ones this run touched — `allGroups` comes from the full case list, so a partial `--only` run never shrinks it.
  const index = {
    version: packageVersion,
    groups: allGroups.map((group) => ({ name: group, title: titleOf(group) })),
  }

  await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(index, null, 2)}\n`)
}

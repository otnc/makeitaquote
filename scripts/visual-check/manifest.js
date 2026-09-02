import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Turns `01-themes` into `Themes`, for the gallery headings. */
export function titleOf(group) {
  return group
    .replace(/^\d+-/, '')
    .replace(/-/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

/**
 * Split one file per group (docs/visual/<group>/manifest.json) plus a small
 * index (docs/visual/manifest.json) listing which groups exist. Two PRs
 * touching different groups now touch different files, full stop — no shared
 * file for them to conflict on. Within a group's own file there is nothing
 * but a pure function of its cases: no timestamp, no counts, nothing that
 * changes between two runs unless the rendered output actually did.
 */
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

  // The index has to list every group that exists, not just the ones this run
  // touched — `allGroups` comes from the full case list, so a partial `--only`
  // run never shrinks it. It changes only when a group is added or removed, or
  // on a version bump, which is rare enough that it is barely ever the thing
  // two branches collide on.
  const index = {
    version: packageVersion,
    groups: allGroups.map((group) => ({ name: group, title: titleOf(group) })),
  }

  await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(index, null, 2)}\n`)
}

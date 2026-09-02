import { join } from 'node:path'
import process from 'node:process'
import pc from 'picocolors'

/** Prints the run summary, and exits non-zero if anything failed. */
export function report({ outDir, root, results, elapsed }) {
  const failed = results.filter((result) => result.problems.length > 0)
  const ok = results.length - failed.length
  const summary = `${ok}/${results.length}`

  console.log(
    `\nvisual-check: ${failed.length === 0 ? pc.green(summary) : summary} ok in ${elapsed}s\n` +
      `  wrote ${join(outDir, 'manifest.json')}\n` +
      `  open  ${join(root, 'docs', 'index.html')}`,
  )

  if (failed.length > 0) {
    console.error(pc.red(`\n${failed.length} case(s) failed:`))
    for (const result of failed) {
      console.error(
        `  ✗ ${result.group}/${result.name}: ${result.error ?? result.problems.join('; ')}`,
      )
    }
    process.exit(1)
  }
}

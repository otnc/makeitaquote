import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import pc from 'picocolors'
import { pngSize, SIGNATURES } from './signatures.js'

/** Renders every selected case, checking each produces a decodable image of the expected shape. */
export async function renderCases(cases, { offline, only, outDir }) {
  const allGroups = [...new Set(cases.map((testCase) => testCase.group))]

  const selected = cases.filter((testCase) => {
    if (offline && testCase.network) return false
    if (only.length === 0) return true
    return only.some(
      (pattern) =>
        testCase.group.toLowerCase().includes(pattern) ||
        testCase.name.toLowerCase().includes(pattern),
    )
  })

  if (selected.length === 0) {
    console.error('visual-check: no cases matched')
    process.exit(1)
  }

  await mkdir(outDir, { recursive: true })

  // Only the groups actually being (re)rendered are cleared — `--only` runs leave every other group untouched.
  const groupsToRender = [...new Set(selected.map((testCase) => testCase.group))]
  for (const group of groupsToRender) {
    await rm(join(outDir, group), { recursive: true, force: true })
    await mkdir(join(outDir, group), { recursive: true })
  }

  console.log(
    `visual-check: rendering ${selected.length} cases${offline ? ' (offline)' : ''} → ${outDir}`,
  )

  const results = []
  const startedAt = Date.now()
  let currentGroup = ''

  for (const testCase of selected) {
    const format = testCase.format ?? 'png'
    const slug = testCase.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const file = `${testCase.group}/${slug || 'case'}.${format === 'jpeg' ? 'jpg' : format}`

    if (testCase.group !== currentGroup) {
      currentGroup = testCase.group
      console.log(`\n  ${currentGroup}`)
    }

    const result = { ...testCase, format, file, problems: [] }

    try {
      const miq = testCase.build()
      const buffer = await miq.toBuffer(format, testCase.encodeOptions)

      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        result.problems.push('produced no bytes')
      } else if (!SIGNATURES[format](buffer)) {
        result.problems.push(`bytes are not a valid ${format}`)
      }

      if (format === 'png' && buffer.length > 24) {
        const size = pngSize(buffer)
        result.size = size
        const expected = testCase.expect ?? {}
        if (expected.width && size.width !== expected.width) {
          result.problems.push(`width ${size.width}, expected ${expected.width}`)
        }
        if (expected.height && size.height !== expected.height) {
          result.problems.push(`height ${size.height}, expected ${expected.height}`)
        }
      }

      result.bytes = buffer.length
      await writeFile(join(outDir, result.file), buffer)
    } catch (error) {
      result.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      result.problems.push('threw')
    }

    results.push(result)

    const ok = result.problems.length === 0
    const status = (ok ? pc.green : pc.red)((ok ? 'ok' : 'FAIL').padEnd(4))
    process.stdout.write(
      `    ${status} ${testCase.name}${result.error ? ` — ${result.error}` : ''}\n`,
    )
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)

  return { allGroups, groupsToRender, results, elapsed }
}

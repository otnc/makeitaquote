import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { findProjectRoot } from './projectRoot'

let dir = ''

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
  dir = ''
})

describe('findProjectRoot', () => {
  it('finds the nearest ancestor with a package.json', async () => {
    dir = await mkdtemp(join(tmpdir(), 'miq-project-root-'))
    await writeFile(join(dir, 'package.json'), '{}')
    const nested = join(dir, 'a', 'b', 'c')
    await mkdir(nested, { recursive: true })

    expect(findProjectRoot(nested)).toBe(dir)
  })

  it('treats the starting directory itself as a candidate', async () => {
    dir = await mkdtemp(join(tmpdir(), 'miq-project-root-self-'))
    await writeFile(join(dir, 'package.json'), '{}')

    expect(findProjectRoot(dir)).toBe(dir)
  })

  it('falls back to the starting directory when none is found', async () => {
    dir = await mkdtemp(join(tmpdir(), 'miq-project-root-none-'))

    expect(findProjectRoot(dir)).toBe(dir)
  })
})

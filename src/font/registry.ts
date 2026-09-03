import { readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { GlobalFonts } from '../render/canvasFactory'
import { GENERIC_FONT_FAMILIES, unquoteFontFamily } from './catalogue'

const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.ttc', '.woff', '.woff2'])

/**
 * Buffers handed to `GlobalFonts.register` are referenced, not copied, so letting one be collected would leave Skia reading freed memory.
 *
 * See https://github.com/Brooooooklyn/canvas/issues/1006.
 */
const retainedBuffers = new Set<Buffer>()

/** Families registered through this package, in registration order. */
const registered: string[] = []

/** Cached set of lowercase family names for fast `has()` lookups. */
let familySetCache: Set<string> | null = null

function invalidateFamilyCache(): void {
  familySetCache = null
}

function getFamilySet(): Set<string> {
  if (familySetCache) return familySetCache
  const set = new Set<string>()
  for (const name of registered) set.add(name.toLowerCase())
  for (const entry of GlobalFonts.families) set.add(entry.family.toLowerCase())
  familySetCache = set
  return set
}

function remember(family: string): void {
  if (!registered.includes(family)) registered.push(family)
}

export const fonts = {
  /** Registers a font file from disk. */
  registerFromPath(path: string, alias?: string): boolean {
    const result = alias
      ? GlobalFonts.registerFromPath(path, alias)
      : GlobalFonts.registerFromPath(path)
    // Skia answers with a font key, or null when the file could not be read.
    const ok = Boolean(result)
    if (ok && alias) remember(alias)
    if (ok) invalidateFamilyCache()
    return ok
  },

  /**
   * Registers a font from memory.
   *
   * The buffer is retained for the lifetime of the process — see the note on `retainedBuffers`. Prefer `registerFromPath` when the font is on disk.
   */
  register(data: Buffer, alias: string): boolean {
    const ok = Boolean(GlobalFonts.register(data, alias))
    if (ok) {
      retainedBuffers.add(data)
      remember(alias)
      invalidateFamilyCache()
    }
    return ok
  },

  /** Registers every font file directly inside a directory. Returns the count. */
  registerFromDir(dir: string): number {
    let count = 0
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return 0
    }

    for (const entry of entries) {
      const path = join(dir, entry)
      try {
        if (!statSync(path).isFile()) continue
      } catch {
        continue
      }
      if (!FONT_EXTENSIONS.has(extname(entry).toLowerCase())) continue
      if (GlobalFonts.registerFromPath(path)) {
        count++
        invalidateFamilyCache()
      }
    }

    return count
  },

  /** Every family the canvas can currently draw with, system fonts included. */
  families(): string[] {
    return GlobalFonts.families.map((family) => family.family)
  },

  /** Whether a family can be drawn with, matched case-insensitively. */
  has(family: string): boolean {
    const wanted = family.trim().toLowerCase()
    if (wanted.length === 0) return false
    return getFamilySet().has(wanted)
  },

  /** Families registered through this package, in the order they were added. */
  registeredFamilies(): string[] {
    return [...registered]
  },
}

/**
 * Resolves a CSS-style font-family list against what is actually available.
 *
 * Returns the first family that can be drawn, or `null` when none can — the caller decides whether that is a warning or an error.
 */
export function resolveFamily(request: string): string | null {
  for (const part of request.split(',')) {
    const family = unquoteFontFamily(part)
    if (family.length === 0) continue
    if (GENERIC_FONT_FAMILIES.has(family)) return family
    if (fonts.has(family)) return family
  }
  return null
}

/** Test seam: forgets what this module registered, without touching Skia. */
export function resetRegistryForTests(): void {
  registered.length = 0
  retainedBuffers.clear()
  invalidateFamilyCache()
}

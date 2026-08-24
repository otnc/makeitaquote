import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { FontNotAvailableError } from '../core/errors'
import type { AutoFontOptions } from '../core/types'
import { createClient } from '../http/client'
import { cachedFontPath, isCached, resolveCacheDir, writeCachedFont } from './diskCache'
import { type FontFace, fileNameFor, resolveGoogleFont, slugFor } from './googleFonts'
import { fonts } from './registry'
import { DEFAULT_FONT_FAMILIES } from './sources'

/** Downloads a font file. Replaceable so tests never touch the network. */
export type FontFetcher = (url: string, signal?: AbortSignal) => Promise<Buffer>

const http = createClient({ timeout: 60_000, retry: 2 })

const defaultFetcher: FontFetcher = (url, signal) => http.getBuffer(url, signal)

export interface EnsureOptions extends AutoFontOptions {
  fetcher?: FontFetcher
  signal?: AbortSignal
  /** Weights to fetch. Defaults to `[400]`; add 700 for a real bold face. */
  weights?: number[]
  italic?: boolean
}

/** One download per file per process, however many renders ask for it. */
const inFlight = new Map<string, Promise<boolean>>()

/** Families already resolved and registered this process. */
const ready = new Set<string>()

/** Warnings are emitted once each, so a busy bot doesn't flood its logs. */
const warned = new Set<string>()

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(message)
}

function noticeOnce(key: string, message: string): void {
  if (warned.has(key)) return
  warned.add(key)
  console.info(message)
}

/**
 * Whether this run is allowed to fetch anything.
 *
 * `online: false` (or `enabled: false`) keeps everything to the disk cache and
 * whatever the system already provides — for air-gapped deployments, or when
 * you simply do not want a render to depend on a third party being up.
 */
function isOnline(options: EnsureOptions): boolean {
  return options.online !== false && options.enabled !== false
}

/**
 * Makes a Google Fonts family available, downloading it only if it has to.
 *
 * Four outcomes, cheapest first: already registered or present on the system,
 * installed in the on-disk cache (works with no network at all), fetched, or
 * given up on. The fetch resolves its URL through the Google Fonts CSS API
 * every time, so the file is always the current release rather than one
 * pinned here — which is also why the disk is only trusted when the API
 * cannot be reached: online, freshness wins; offline, anything beats tofu.
 */
export async function useFont(family: string, options: EnsureOptions = {}): Promise<boolean> {
  if (ready.has(family) || fonts.has(family)) return true

  if (!isOnline(options)) {
    if (await registerFromDiskCache(family, options)) {
      ready.add(family)
      return true
    }
    warnOnce(
      `offline:${family}`,
      `makeitaquote: "${family}" is not available and font downloading is off. ` +
        'Register it with fonts.registerFromPath(), or drop the file into ' +
        `${resolveCacheDir(options.cacheDir)}.`,
    )
    return false
  }

  let faces: FontFace[]
  try {
    faces = await resolveGoogleFont(family, {
      ...(options.weights ? { weights: options.weights } : {}),
      ...(options.italic === undefined ? {} : { italic: options.italic }),
      ...(options.signal ? { signal: options.signal } : {}),
    })
  } catch (cause) {
    // The CSS API is unreachable — an air-gapped machine with the family
    // already installed (`miq install fonts`) should still render.
    if (await registerFromDiskCache(family, options)) {
      ready.add(family)
      return true
    }
    warnOnce(
      `resolve:${family}`,
      `makeitaquote: ${cause instanceof Error ? cause.message : String(cause)}`,
    )
    return false
  }

  const results = await Promise.all(faces.map((face) => ensureFace(family, face, options)))
  const ok = results.some(Boolean)
  if (ok) ready.add(family)
  return ok
}

/**
 * Downloads a family into the on-disk cache, whether or not it is needed.
 *
 * The install command's entry point, and deliberately not `useFont`: that
 * returns `true` the moment the system already provides the family, which is
 * right for rendering but wrong for installing — the point there is that the
 * *file* exists, so the next machine or an offline one can use it.
 *
 * Weights default to `[400, 700]` here rather than `useFont`'s `[400]`: an
 * install is for keeps, and a real bold face beats the synthetic stroke.
 */
export async function installFont(family: string, options: EnsureOptions = {}): Promise<boolean> {
  const weights = options.weights ?? [400, 700]

  if (!isOnline(options)) {
    warnOnce(
      `offline:${family}`,
      `makeitaquote: cannot install "${family}" with font downloading off.`,
    )
    return false
  }

  let faces: FontFace[]
  try {
    faces = await resolveGoogleFont(family, {
      weights,
      ...(options.italic === undefined ? {} : { italic: options.italic }),
      ...(options.signal ? { signal: options.signal } : {}),
    })
  } catch (cause) {
    warnOnce(
      `resolve:${family}`,
      `makeitaquote: ${cause instanceof Error ? cause.message : String(cause)}`,
    )
    return false
  }

  const results = await Promise.all(faces.map((face) => ensureFace(family, face, options)))
  // Registration failing is not installation failing: the file landing on
  // disk is what installing means, and the process that reads it back runs
  // its own Skia anyway.
  const dir = resolveCacheDir(options.cacheDir)
  return results.some(Boolean) || faces.some((face) => isCached(dir, fileNameFor(face)))
}

/**
 * Registers whatever the on-disk cache holds for a family, sight unseen.
 *
 * The offline path: files land there through `miq install fonts` (or an
 * earlier online render), and matching on the family's slug finds them with
 * no network roundtrip. Every weight and style found is registered under the
 * one family name, and Skia picks between them.
 */
async function registerFromDiskCache(family: string, options: EnsureOptions): Promise<boolean> {
  const dir = resolveCacheDir(options.cacheDir)
  const prefix = `${slugFor(family)}-`

  let names: string[]
  try {
    names = readdirSync(dir).filter((name) => name.startsWith(prefix) && name.endsWith('.ttf'))
  } catch {
    return false
  }
  if (names.length === 0) return false

  let ok = false
  for (const name of names) {
    if (fonts.registerFromPath(join(dir, name), family)) ok = true
  }
  return ok
}

async function ensureFace(
  family: string,
  face: FontFace,
  options: EnsureOptions,
): Promise<boolean> {
  const dir = resolveCacheDir(options.cacheDir)
  const fileName = fileNameFor(face)

  if (isCached(dir, fileName)) {
    return fonts.registerFromPath(cachedFontPath(dir, fileName), family)
  }

  const key = `${dir}:${fileName}`
  const existing = inFlight.get(key)
  if (existing) return existing

  const download = (async () => {
    noticeOnce(
      `download:${family}`,
      `makeitaquote: downloading ${family} to ${dir} — this happens once. ` +
        'Pass autoFont: false (or online: false) to disable.',
    )

    const fetcher = options.fetcher ?? defaultFetcher
    const bytes = await fetcher(face.url, options.signal)
    options.onProgress?.({
      family,
      received: bytes.byteLength,
      total: bytes.byteLength,
    })

    const path = await writeCachedFont(dir, fileName, bytes)
    // Registering from the file rather than the buffer sidesteps the lifetime
    // problem in GlobalFonts.register — see font/registry.ts.
    return fonts.registerFromPath(path, family)
  })()
    .catch((cause: unknown) => {
      warnOnce(
        `failed:${family}`,
        `makeitaquote: could not download ${family} ` +
          `(${cause instanceof Error ? cause.message : String(cause)}). ` +
          'Falling back to system fonts; text may render as boxes. ' +
          'To fix this, register a font yourself with ' +
          `fonts.registerFromPath(path, family), or place the file at ${cachedFontPath(dir, fileName)}.`,
      )
      return false
    })
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, download)
  return download
}

/**
 * Fetches an explicit URL rather than going through Google Fonts.
 *
 * The escape hatch for fonts this package will not resolve by name — anything
 * not on Google Fonts, including ones you have licensed yourself.
 */
export async function registerFontFromURL(
  url: string,
  family: string,
  options: EnsureOptions = {},
): Promise<boolean> {
  if (fonts.has(family)) return true
  if (!isOnline(options)) return false

  return ensureFace(family, { family, url, weight: 400, style: 'normal' }, options)
}

/**
 * Makes the default families available.
 *
 * Useful at startup, or at build time with `MIQ_FONT_CACHE_DIR` set, so no
 * render ever waits for a download. Offline, this is what turns files
 * installed by `miq install fonts` into registered families — `useFont`
 * reads the disk when it cannot reach Google.
 */
export async function ensureDefaultFonts(options: EnsureOptions = {}): Promise<void> {
  const families = options.families ?? DEFAULT_FONT_FAMILIES
  await Promise.all(families.map((family) => useFont(family, options)))
}

/**
 * Warns once that a family is missing, naming the fix.
 *
 * Missing fonts render as tofu, which is baffling if you don't know what
 * caused it — so this says so out loud rather than failing silently.
 */
export function warnMissingFamily(request: string): void {
  warnOnce(
    `missing:${request}`,
    `makeitaquote: no font found for "${request}". Text may render as boxes. ` +
      'Register one with fonts.registerFromPath(path, family), or name a Google Fonts ' +
      'family and leave autoFont enabled.',
  )
}

export interface AssetErrorOptions {
  strictFonts?: boolean
  onAssetError?: 'ignore' | 'text' | 'throw'
}

/**
 * Reports fonts that are still missing after autoload, following `strictFonts`
 * and `onAssetError` the same way everywhere: `strictFonts` (or `'throw'`)
 * raises, `'ignore'` says nothing, and the default (`'text'`) warns and lets
 * rendering fall through to whatever font the system already has.
 */
export function reportMissingFonts(missing: readonly string[], options: AssetErrorOptions): void {
  if (missing.length === 0) return

  const mode = options.strictFonts ? 'throw' : (options.onAssetError ?? 'text')

  if (mode === 'throw') {
    throw new FontNotAvailableError(
      `No font available for "${missing[0]}". Register one with fonts.registerFromPath(), ` +
        'or name a family Google Fonts serves.',
      { family: missing[0] as string },
    )
  }

  if (mode === 'ignore') return

  for (const request of missing) warnMissingFamily(request)
}

/** Test seam: clears the once-only log state, in-flight downloads and cache. */
export function resetAutoloadForTests(): void {
  warned.clear()
  inFlight.clear()
  ready.clear()
}

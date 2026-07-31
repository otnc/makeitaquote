import type { AutoFontOptions } from '../core/types'
import { createClient } from '../http/client'
import { cachedFontPath, isCached, resolveCacheDir, writeCachedFont } from './diskCache'
import { type FontFace, fileNameFor, resolveGoogleFont } from './googleFonts'
import { fonts } from './registry'
import { DEFAULT_FONT_FAMILIES } from './sources'

/** Downloads a font file. Replaceable so tests never touch the network. */
export type FontFetcher = (url: string, signal?: AbortSignal) => Promise<Buffer>

const http = createClient({ timeout: 60_000, retry: 2 })

const defaultFetcher: FontFetcher = async (url, signal) => {
  const response = await http.get(url, signal ? { signal } : {})
  return Buffer.from(await response.arrayBuffer())
}

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
 * Three outcomes, cheapest first: already registered or present on the system,
 * present in the on-disk cache, or fetched. Only the last touches the network.
 *
 * The download URL is resolved through the Google Fonts CSS API every time, so
 * the file is always the current release rather than one pinned here.
 */
export async function useFont(family: string, options: EnsureOptions = {}): Promise<boolean> {
  if (ready.has(family) || fonts.has(family)) return true

  if (!isOnline(options)) {
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
 * render ever waits for a download.
 */
export async function ensureDefaultFonts(options: EnsureOptions = {}): Promise<void> {
  if (!isOnline(options)) return

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

/** Test seam: clears the once-only log state, in-flight downloads and cache. */
export function resetAutoloadForTests(): void {
  warned.clear()
  inFlight.clear()
  ready.clear()
}

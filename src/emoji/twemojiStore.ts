import { existsSync, statSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { createClient } from '@makeitaquote/utils/http'
import { pLimit } from 'plimit-lit'
import { resolveCacheDir } from '../font/diskCache'

const http = createClient({ timeout: 30_000, retry: 2 })

/** Where the file list comes from — the jsDelivr data API, not the CDN itself. */
const PACKAGE = 'gh/jdecked/twemoji'
const VERSIONS_URL = `https://data.jsdelivr.com/v1/packages/${PACKAGE}`
const CDN_BASE = 'https://cdn.jsdelivr.net'

/** The one size `@twemoji/parser` asks the CDN for, and so the one we keep. */
const ASSET_PATH = 'assets/72x72'

/** Downloads one image. Replaceable so tests never touch the network. */
export type TwemojiFetcher = (url: string, signal?: AbortSignal) => Promise<Buffer>

const defaultFetcher: TwemojiFetcher = (url, signal) => http.getBuffer(url, signal)

export interface TwemojiListing {
  /** The release the files belong to, e.g. `'17.0.3'`. */
  version: string
  /** Bare file names, e.g. `['1f642.png', …]`. */
  files: string[]
}

export interface InstallTwemojiOptions {
  /** Where to put the images. Defaults to `resolveTwemojiDir()`. */
  dir?: string
  signal?: AbortSignal
  /** Cap on simultaneous downloads. Default 16. */
  concurrency?: number
  onProgress?: (done: number, total: number) => void
  /** Replaceable so tests never touch the network. */
  list?: () => Promise<TwemojiListing>
  fetcher?: TwemojiFetcher
}

export interface TwemojiInstallResult {
  dir: string
  version: string
  total: number
  /** Files written by this run — the rest were already on disk. */
  downloaded: number
  skipped: number
}

export interface TwemojiInfo {
  dir: string
  images: number
  bytes: number
  /** The release recorded at install time, when a manifest is present. */
  version: string | null
}

/**
 * Where installed Twemoji images live.
 *
 * A sibling of the font cache rather than inside it: the font cache is
 * `rm -rf`'d wholesale by `uninstallFonts()`, and Twemoji surviving that (or
 * the other way round) is what lets the two be managed separately.
 */
export function resolveTwemojiDir(override?: string): string {
  if (override) return override

  const fromEnv = process.env.MIQ_TWEMOJI_CACHE_DIR
  if (fromEnv) return fromEnv

  return join(dirname(resolveCacheDir()), 'twemoji')
}

/**
 * The local file name a Twemoji CDN url maps to, or `null` for anything else.
 *
 * `@twemoji/parser` builds `…/twemoji@<tag>/assets/72x72/<codepoints>.png`,
 * where `<tag>` is whatever version tag it was configured with — the tag is
 * dropped here so a locally installed file matches the url whatever tag the
 * parser currently emits.
 */
export function twemojiFileName(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.host !== 'cdn.jsdelivr.net') return null
  const match = new RegExp(`^/${PACKAGE}@[^/]+/${ASSET_PATH}/([0-9a-f-]+)\\.png$`).exec(
    parsed.pathname,
  )
  return match ? `${match[1]}.png` : null
}

/**
 * The path of a locally installed copy of a Twemoji CDN url, or `null`.
 *
 * This is the seam the emoji loader consults before the network: a file put
 * there by `miq install twemoji` makes rendering work with no connection.
 */
export function localTwemojiFile(url: string, dir = resolveTwemojiDir()): string | null {
  const name = twemojiFileName(url)
  if (!name) return null

  const path = join(dir, name)
  try {
    return existsSync(path) && statSync(path).size > 0 ? path : null
  } catch {
    return null
  }
}

/**
 * Downloads every Twemoji image to the local store.
 *
 * Idempotent: a file already on disk is left alone, so an interrupted install
 * resumes rather than starts over. Re-running after a new Twemoji release
 * keeps the existing files — `miq uninstall twemoji` first if a clean
 * re-download is wanted.
 */
export async function installTwemoji(
  options: InstallTwemojiOptions = {},
): Promise<TwemojiInstallResult> {
  const dir = options.dir ?? resolveTwemojiDir()
  const { version, files } = await (options.list ?? listTwemojiFiles)()

  await mkdir(dir, { recursive: true })

  const limit = pLimit(Math.max(1, options.concurrency ?? 16))
  const fetcher = options.fetcher ?? defaultFetcher
  let done = 0
  let downloaded = 0
  let skipped = 0

  await Promise.all(
    files.map((name) =>
      limit(async () => {
        const target = join(dir, name)
        if (!isInstalled(target)) {
          const bytes = await fetcher(cdnUrl(version, name), options.signal)
          await writeFile(target, bytes)
          downloaded++
        } else {
          skipped++
        }
        done++
        options.onProgress?.(done, files.length)
      }),
    ),
  )

  await writeFile(
    join(dir, 'manifest.json'),
    `${JSON.stringify({ version, count: files.length, installedAt: new Date().toISOString() }, null, 2)}\n`,
  )

  return { dir, version, total: files.length, downloaded, skipped }
}

/** Removes every installed image. A no-op when nothing is installed. */
export async function uninstallTwemoji(dir = resolveTwemojiDir()): Promise<void> {
  await rm(dir, { recursive: true, force: true })
}

/** What is currently installed, for `miq ls` and friends. */
export async function twemojiInfo(dir = resolveTwemojiDir()): Promise<TwemojiInfo> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return { dir, images: 0, bytes: 0, version: null }
  }

  let images = 0
  let bytes = 0
  for (const entry of entries) {
    if (!entry.endsWith('.png')) continue
    try {
      bytes += statSync(join(dir, entry)).size
      images++
    } catch {
      // Removed between listing and stat; not worth failing over.
    }
  }

  return { dir, images, bytes, version: await installedVersion(dir) }
}

/** A file is "installed" when it exists and is non-empty, same rule as fonts. */
function isInstalled(path: string): boolean {
  try {
    return statSync(path).size > 0
  } catch {
    return false
  }
}

async function installedVersion(dir: string): Promise<string | null> {
  try {
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as {
      version?: unknown
    }
    return typeof manifest.version === 'string' ? manifest.version : null
  } catch {
    return null
  }
}

function cdnUrl(version: string, name: string): string {
  return `${CDN_BASE}/${PACKAGE}@${version}/${ASSET_PATH}/${name}`
}

/** The newest Twemoji release tag, or `null` when jsDelivr could not be reached. */
export async function latestTwemojiVersion(): Promise<string | null> {
  try {
    return await fetchLatestVersion()
  } catch {
    return null
  }
}

async function fetchLatestVersion(): Promise<string> {
  const versions = (await getJson(VERSIONS_URL)) as { versions?: Array<{ version?: unknown }> }
  const version = versions.versions?.[0]?.version
  if (typeof version !== 'string') {
    throw new Error('Could not read the Twemoji release list from jsDelivr')
  }
  return version
}

/**
 * Every image in the newest Twemoji release, via the jsDelivr data API.
 *
 * The CDN itself serves files but not a directory listing, so the file list
 * comes from the API beside it. `@twemoji/parser` can parse emoji but cannot
 * enumerate them, so there is no offline source for the list.
 */
async function listTwemojiFiles(): Promise<TwemojiListing> {
  const version = await fetchLatestVersion()

  const listing = (await getJson(`${VERSIONS_URL}@${version}?structure=flat`)) as {
    files?: Array<{ name?: unknown }>
  }
  const files = (listing.files ?? [])
    .map((file) => (typeof file.name === 'string' ? file.name : null))
    .filter((name): name is string => name !== null)
    .filter((name) => name.startsWith(`/${ASSET_PATH}/`) && name.endsWith('.png'))
    .map((name) => name.slice(name.lastIndexOf('/') + 1))

  if (files.length === 0) {
    throw new Error(`jsDelivr listed no Twemoji images for ${version}`)
  }

  return { version, files }
}

async function getJson(url: string): Promise<unknown> {
  const response = await http.get(url)
  return response.json()
}

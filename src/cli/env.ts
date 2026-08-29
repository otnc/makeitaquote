import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'
import { resolveTwemojiDir } from '../emoji/twemojiStore'
import { resolveCacheDir } from '../font/diskCache'
import { createClient } from '../http/client'
import { findProjectRoot } from '../util/projectRoot'

export interface StorageStatus {
  projectRoot: string
  fontsDir: string
  fontsWritable: boolean
  twemojiDir: string
  twemojiWritable: boolean
  fontCacheDirEnv: string | null
  twemojiCacheDirEnv: string | null
}

export interface NetworkStatus {
  host: string
  reachable: boolean
}

export interface EnvReport {
  storage: StorageStatus
  network: NetworkStatus[]
}

const http = createClient({ timeout: 5_000, retry: 0 })

/** Every host miq talks to, for `miq env`'s reachability check. */
const NETWORK_HOSTS = [
  { host: 'fonts.googleapis.com', url: 'https://fonts.googleapis.com/css2' },
  { host: 'cdn.jsdelivr.net', url: 'https://cdn.jsdelivr.net' },
  { host: 'data.jsdelivr.com', url: 'https://data.jsdelivr.com/v1/packages/gh/jdecked/twemoji' },
  { host: 'registry.npmjs.org', url: 'https://registry.npmjs.org/makeitaquote/latest' },
]

/**
 * Whether `dir` (or the nearest parent that exists) can be written to.
 *
 * Only checks — never creates `dir` itself, so running `miq env` doesn't
 * conjure a cache directory into existence just to ask about it.
 */
async function checkWritable(dir: string): Promise<boolean> {
  try {
    await access(dir, constants.W_OK)
    return true
  } catch {
    // Doesn't exist yet — what matters is whether it could be created.
  }
  try {
    await access(dirname(dir), constants.W_OK)
    return true
  } catch {
    return false
  }
}

/**
 * A response, even an error one, means the network and TLS are fine.
 *
 * HEAD rather than GET: this only asks whether the host is reachable, not
 * for anything in the body, so there's no reason to download one — even an
 * error status or a 405 for HEAD itself still proves the network and TLS
 * are fine, which is all this checks.
 */
async function checkReachable(url: string): Promise<boolean> {
  try {
    await http.head(url, { throwHttpErrors: false })
    return true
  } catch {
    return false
  }
}

/** What `miq env` reports: where things are, whether they're writable, and what's reachable. */
export async function checkEnv(): Promise<EnvReport> {
  const fontsDir = resolveCacheDir()
  const twemojiDir = resolveTwemojiDir()

  const [fontsWritable, twemojiWritable, network] = await Promise.all([
    checkWritable(fontsDir),
    checkWritable(twemojiDir),
    Promise.all(
      NETWORK_HOSTS.map(async ({ host, url }) => ({ host, reachable: await checkReachable(url) })),
    ),
  ])

  return {
    storage: {
      projectRoot: findProjectRoot(),
      fontsDir,
      fontsWritable,
      twemojiDir,
      twemojiWritable,
      fontCacheDirEnv: process.env.MIQ_FONT_CACHE_DIR ?? null,
      twemojiCacheDirEnv: process.env.MIQ_TWEMOJI_CACHE_DIR ?? null,
    },
    network,
  }
}

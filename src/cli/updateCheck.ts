import { createClient } from '@makeitaquote/utils/http'

const REGISTRY_URL = 'https://registry.npmjs.org/makeitaquote/latest'

const http = createClient({ timeout: 8_000, retry: 1 })

export interface PackageUpdateStatus {
  current: string
  /** `null` when the npm registry could not be reached. */
  latest: string | null
}

/** Asks the npm registry what the newest published version is. */
export async function checkPackageUpdate(current: string): Promise<PackageUpdateStatus> {
  try {
    const response = await http.get(REGISTRY_URL)
    const data = (await response.json()) as { version?: unknown }
    return { current, latest: typeof data.version === 'string' ? data.version : null }
  } catch {
    return { current, latest: null }
  }
}

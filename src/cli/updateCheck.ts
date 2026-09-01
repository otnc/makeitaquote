import { isPackageLatest } from 'is-package-latest'

const PACKAGE_NAME = 'makeitaquote'

export interface PackageUpdateStatus {
  current: string
  /** `null` when the npm registry could not be reached. */
  latest: string | null
}

/** Asks the npm registry what the newest published version is. */
export async function checkPackageUpdate(current: string): Promise<PackageUpdateStatus> {
  const result = await isPackageLatest(
    { name: PACKAGE_NAME, version: current },
    { timeout: 8_000, retry: 1 },
  )
  return { current, latest: result.latestVersion }
}

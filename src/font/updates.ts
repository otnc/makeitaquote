import { isNewerVersion } from '../util/version'
import { resolveGoogleFont, versionFor } from './googleFonts'
import type { InstalledFont } from './install'

export interface FontUpdateStatus {
  family: string
  installedVersion: string
  /** `null` when Google Fonts could not be reached to check. */
  latestVersion: string | null
  outdated: boolean
}

/**
 * Compares each installed family's cached version against what Google Fonts currently serves.
 *
 * Only a CSS request per family — the same lookup `useFont`/`installFont` already make before downloading anything — so this never fetches font bytes just to check.
 */
export async function checkFontUpdates(
  installed: readonly InstalledFont[],
): Promise<FontUpdateStatus[]> {
  return Promise.all(installed.map(checkOne))
}

async function checkOne(font: InstalledFont): Promise<FontUpdateStatus> {
  try {
    const faces = await resolveGoogleFont(font.family, {
      weights: font.weights,
      italic: font.italic,
    })
    const latestVersion = faces
      .map(versionFor)
      .reduce((newest, version) => (isNewerVersion(newest, version) ? version : newest))

    return {
      family: font.family,
      installedVersion: font.version,
      latestVersion,
      outdated: isNewerVersion(font.version, latestVersion),
    }
  } catch {
    return {
      family: font.family,
      installedVersion: font.version,
      latestVersion: null,
      outdated: false,
    }
  }
}

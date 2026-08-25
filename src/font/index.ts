import { type EnsureOptions, ensureDefaultFonts, registerFontFromURL, useFont } from './autoload'
import { FONT_CATALOGUE, isCatalogued } from './catalogue'
import { cacheInfo, clearCache } from './diskCache'
import { resolveGoogleFont } from './googleFonts'
import { fonts as registry } from './registry'

/**
 * The font API.
 *
 * Composed here rather than in `registry.ts` because the download side needs
 * the registry, and having the registry reach back for it would be circular.
 */
export const fonts = {
  ...registry,

  /**
   * Makes a Google Fonts family usable, downloading it if needed.
   *
   * ```ts
   * await fonts.use('Dela Gothic One')
   * await fonts.use('pop')                                  // FONT_ALIASES short name too
   * await fonts.use('Noto Sans JP', { weights: [400, 700] }) // real bold
   * ```
   *
   * Only families Google Fonts serves can be fetched by name — which are all
   * openly licensed. For anything else, use `registerFromPath` or
   * `registerFromURL`.
   */
  use: (family: string, options?: EnsureOptions) => useFont(family, options),

  /** Fetches a font from an explicit URL and registers it under `family`. */
  registerFromURL: registerFontFromURL,

  /**
   * Makes the default families available.
   *
   * Call this at startup, or at image-build time with `MIQ_FONT_CACHE_DIR`
   * set, so no render ever has to wait for a download.
   */
  ensureDefaults: (options?: EnsureOptions) => ensureDefaultFonts(options),

  /** Families this package can fetch by name without any further setup. */
  catalogue: () => [...FONT_CATALOGUE],

  /** Whether a name is in `catalogue()`. Any Google Fonts family also works. */
  isCatalogued,

  /**
   * Looks up where Google currently serves a family, without downloading it.
   *
   * Throws `AssetFetchError` when Google does not serve it, which is also how
   * paid or otherwise-licensed fonts are rejected.
   */
  resolve: resolveGoogleFont,

  /** Where downloaded fonts live, what is there, and how large it is. */
  cacheInfo,

  /** Empties the download cache. */
  clearCache,
}

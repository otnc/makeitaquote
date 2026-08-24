import { AssetFetchError } from '../core/errors'
import { createClient } from '../http/client'
import { suggestionFor, unavailableReason } from './catalogue'

const CSS_ENDPOINT = 'https://fonts.googleapis.com/css2'

const http = createClient({ timeout: 30_000, retry: 2 })

export interface FontFace {
  /** Family as Google Fonts spells it. */
  family: string
  weight: number
  style: 'normal' | 'italic'
  /** Direct link to the TTF. Versioned, so it changes when Google updates it. */
  url: string
}

export interface ResolveOptions {
  /** Weights to fetch. Defaults to `[400]`. */
  weights?: number[]
  italic?: boolean
  signal?: AbortSignal
  /** Replaceable so tests never hit the network. */
  fetchCss?: (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>
}

/**
 * Asks Google Fonts where the current files for a family are.
 *
 * Resolving through the CSS API rather than hard-coding URLs means the fonts
 * are always whatever Google serves today — the URLs carry a version that
 * changes when a family is updated. It also doubles as the licence check: if
 * Google does not serve it, this package will not fetch it from anywhere else.
 *
 * The API answers with TTF for user agents it can't confirm support WOFF2,
 * which includes ours — and TTF is what the canvas can register.
 */
export async function resolveGoogleFont(
  family: string,
  options: ResolveOptions = {},
): Promise<FontFace[]> {
  const weights = normalizeWeights(options.weights)
  const url = buildCssUrl(family, weights, options.italic ?? false)

  const response = await fetchCss(url, options)

  if (!response.ok) {
    throw new AssetFetchError(describeFailure(family, response.status), {
      kind: 'font',
      url,
      status: response.status,
    })
  }

  const css = await response.text()
  const faces = parseCss(css, family)

  if (faces.length === 0) {
    throw new AssetFetchError(`Google Fonts returned no usable font file for "${family}".`, {
      kind: 'font',
      url,
    })
  }

  return faces
}

async function fetchCss(url: string, options: ResolveOptions) {
  if (options.fetchCss) return options.fetchCss(url)
  try {
    return await http.get(url, {
      throwHttpErrors: false,
      ...(options.signal ? { signal: options.signal } : {}),
    })
  } catch (cause) {
    throw new AssetFetchError(`Could not reach Google Fonts to resolve "${url}".`, {
      kind: 'font',
      url,
      cause,
    })
  }
}

function describeFailure(family: string, status: number): string {
  if (status !== 400) {
    return `Google Fonts answered ${status} for "${family}".`
  }

  const reason = unavailableReason(family)
  if (reason) {
    return `"${family}" is ${reason}. Download it yourself and register it with fonts.registerFromPath().`
  }

  const suggestion = suggestionFor(family)
  const hint = suggestion ? ` Did you mean "${suggestion}"?` : ''
  return (
    `"${family}" is not available on Google Fonts.${hint} ` +
    'Only fonts Google serves — which are all openly licensed — can be fetched by name; ' +
    'for anything else use fonts.registerFromPath().'
  )
}

/** `Family Name` → `Family+Name:wght@400;700`, as the CSS API wants it. */
function buildCssUrl(family: string, weights: number[], italic: boolean): string {
  const name = family.trim().replaceAll(/\s+/g, '+')

  if (italic) {
    const pairs = weights.flatMap((weight) => [`0,${weight}`, `1,${weight}`]).join(';')
    return `${CSS_ENDPOINT}?family=${name}:ital,wght@${pairs}`
  }

  // A bare family name gets the default face, which is the smallest download.
  if (weights.length === 1 && weights[0] === 400) {
    return `${CSS_ENDPOINT}?family=${name}`
  }

  return `${CSS_ENDPOINT}?family=${name}:wght@${weights.join(';')}`
}

function normalizeWeights(weights: number[] | undefined): number[] {
  if (!weights || weights.length === 0) return [400]
  const unique = [...new Set(weights)].filter((weight) => Number.isFinite(weight))
  return unique.length > 0 ? unique.sort((a, b) => a - b) : [400]
}

/**
 * Pulls the font files out of the CSS.
 *
 * Each `@font-face` block carries its own weight and style, so a request for
 * several weights comes back as several blocks.
 */
function parseCss(css: string, requested: string): FontFace[] {
  const faces: FontFace[] = []

  for (const block of css.split('@font-face').slice(1)) {
    const url = /url\((https:\/\/[^)]+\.(?:ttf|otf))\)/.exec(block)?.[1]
    if (!url) continue

    const family = /font-family:\s*'([^']+)'/.exec(block)?.[1] ?? requested
    const weight = Number(/font-weight:\s*(\d+)/.exec(block)?.[1] ?? 400)
    const style = /font-style:\s*italic/.test(block) ? 'italic' : 'normal'

    // Google repeats a face per unicode-range subset; one file each is enough.
    if (faces.some((face) => face.url === url)) continue

    faces.push({ family, weight, style, url })
  }

  return faces
}

/** The cache-file name prefix for a family — see `fileNameFor`. */
export function slugFor(family: string): string {
  return family.trim().replaceAll(/[^\w]+/g, '-')
}

/** A stable file name for a resolved face, used inside the on-disk cache. */
export function fileNameFor(face: FontFace): string {
  const slug = slugFor(face.family)
  const id = /\/s\/[^/]+\/(?:v\d+\/)?([^/?]+?)\.(?:ttf|otf)$/.exec(face.url)?.[1]
  const suffix = face.style === 'italic' ? '-italic' : ''
  // The hashed id keeps a stale file from being reused after Google updates.
  return `${slug}-${versionFor(face)}-${face.weight}${suffix}-${id ?? 'font'}.ttf`
}

/** The Google Fonts asset version a face was served at, e.g. `v30`. */
export function versionFor(face: FontFace): string {
  return /\/(v\d+)\//.exec(face.url)?.[1] ?? 'v0'
}

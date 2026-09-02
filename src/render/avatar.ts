import { readFile } from 'node:fs/promises'
import type { AvatarSource } from '../core/types'
import { createClient } from '../http/client'
import { parseColor, toCSS } from '../theme/color'
import type { AvatarTheme } from '../theme/types'
import type { AssetCache } from '../util/assetCache'
import { avatarCache } from './avatarCache'
import { createCanvas, type Image, loadImage, type SKRSContext2D } from './canvasFactory'

const http = createClient({ timeout: 15_000, retry: 2 })

/** Fetches the bytes for a URL. Replaceable so tests never touch the network. */
export type AvatarFetcher = (url: string, signal?: AbortSignal) => Promise<Buffer>

const defaultFetcher: AvatarFetcher = (url, signal) => http.getBuffer(url, signal)

export interface LoadAvatarOptions {
  signal?: AbortSignal
  fetcher?: AvatarFetcher
  /** Which cache to dedupe through. Defaults to the shared avatar cache. */
  cache?: AssetCache<Image>
}

/**
 * Loads an avatar from wherever it came from.
 *
 * Returns `null` rather than throwing when it can't be loaded — a quote with a
 * placeholder avatar is more useful than no quote at all.
 */
export async function loadAvatar(
  source: AvatarSource | null,
  options: LoadAvatarOptions = {},
): Promise<Image | null> {
  if (source === null) return null

  if (source instanceof Uint8Array) {
    try {
      return await loadImage(source)
    } catch {
      return null
    }
  }

  const url = source instanceof URL ? source.href : source

  if (url.startsWith('data:')) {
    try {
      return await loadImage(url)
    } catch {
      return null
    }
  }

  // http(s) and local paths are worth caching: the same user's avatar is
  // often requested again within seconds of the last quote. Buffers and
  // data: URLs are already in memory, so caching them would only add
  // bookkeeping for no benefit.
  return loadCached(url, options)
}

async function loadCached(key: string, options: LoadAvatarOptions): Promise<Image | null> {
  const cache = options.cache ?? avatarCache
  const cached = cache.cached(key)
  if (cached) return cached
  if (cache.isKnownFailure(key)) return null

  return cache.coalesce(key, async () => {
    try {
      const bytes = /^https?:\/\//i.test(key)
        ? await (options.fetcher ?? defaultFetcher)(key, options.signal)
        : await readFile(key)
      const image = await loadImage(bytes)
      cache.remember(key, image)
      return image
    } catch {
      cache.rememberFailure(key)
      return null
    }
  })
}

export interface AvatarBox {
  x: number
  y: number
  width: number
  height: number
}

/** The avatar rectangle from a computed layout. */
export function avatarBox(layout: { avatar: AvatarBox }): AvatarBox {
  return layout.avatar
}

/**
 * The source rectangle that fills `box` without distorting the image.
 *
 * `object-fit: cover` in canvas terms: scale to the larger of the two ratios
 * and centre the overflow.
 */
export function coverRect(
  imageWidth: number,
  imageHeight: number,
  box: AvatarBox,
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(box.width / imageWidth, box.height / imageHeight)
  const sw = box.width / scale
  const sh = box.height / scale
  return {
    sx: (imageWidth - sw) / 2,
    sy: (imageHeight - sh) / 2,
    sw,
    sh,
  }
}

/**
 * The destination rectangle that fits the whole image inside `box`.
 *
 * `object-fit: contain`: nothing is cropped, and the image is centred in
 * whatever space is left over.
 */
export function containRect(imageWidth: number, imageHeight: number, box: AvatarBox): AvatarBox {
  const scale = Math.min(box.width / imageWidth, box.height / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  }
}

let filterSupported: boolean | null = null

/**
 * Whether this build of the canvas honours `ctx.filter`.
 *
 * Detected once by drawing a white pixel through a grayscale filter that also
 * shifts brightness; if the pixel comes back unchanged the filter was ignored.
 */
function supportsFilter(): boolean {
  if (filterSupported !== null) return filterSupported

  try {
    const probe = createCanvas(1, 1)
    const ctx = probe.getContext('2d')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, 1, 1)
    ctx.filter = 'brightness(0)'
    ctx.fillRect(0, 0, 1, 1)
    filterSupported = ctx.getImageData(0, 0, 1, 1).data[0] === 0
  } catch {
    filterSupported = false
  }

  return filterSupported
}

/** Rec.709 luma, the same weighting a display uses. */
function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

interface Circle {
  cx: number
  cy: number
  radius: number
}

/** The largest circle that fits inside `box`, centred — matches `clipToCircle()`. */
function circleFor(box: AvatarBox): Circle {
  return {
    cx: box.x + box.width / 2,
    cy: box.y + box.height / 2,
    radius: Math.min(box.width, box.height) / 2,
  }
}

/**
 * Desaturates a region in place, for when `ctx.filter` isn't available.
 *
 * `box` comes from ratio-based layout math and is rarely integer-aligned;
 * `getImageData`/`putImageData` need integer pixels, so this rounds outward
 * (floor the origin, ceil the far edge) rather than truncating, to always
 * cover the whole painted area instead of clipping a row or column of it.
 *
 * `getImageData`/`putImageData` ignore the canvas's own clip path, so a
 * `circle` clip must be re-applied by hand here — otherwise a circle-shaped
 * avatar desaturates the card background sitting in the box's corners too.
 */
function desaturateRegion(ctx: SKRSContext2D, box: AvatarBox, circle?: Circle): void {
  const x = Math.floor(box.x)
  const y = Math.floor(box.y)
  const width = Math.ceil(box.x + box.width) - x
  const height = Math.ceil(box.y + box.height) - y

  const image = ctx.getImageData(x, y, width, height)
  const { data } = image
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (circle) {
        const dx = x + col + 0.5 - circle.cx
        const dy = y + row + 0.5 - circle.cy
        if (dx * dx + dy * dy > circle.radius * circle.radius) continue
      }
      const i = (row * width + col) * 4
      const value = luma(data[i] as number, data[i + 1] as number, data[i + 2] as number)
      data[i] = value
      data[i + 1] = value
      data[i + 2] = value
    }
  }
  ctx.putImageData(image, x, y)
}

export interface DrawAvatarOptions {
  theme: AvatarTheme
  box: AvatarBox
  /** Drawn into the fallback tile when there is no image. */
  initial?: string
  fallbackFont?: string
}

/**
 * Clips to the largest circle that fits inside `box`, centred.
 *
 * A wide or tall box leaves background showing at the sides or top and
 * bottom — same as a round profile picture would on any other card shape.
 */
function clipToCircle(ctx: SKRSContext2D, box: AvatarBox): void {
  const { cx, cy, radius } = circleFor(box)
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
}

/** Draws the avatar, or a placeholder tile when there is none. */
export function drawAvatar(
  ctx: SKRSContext2D,
  image: Image | null,
  options: DrawAvatarOptions,
): void {
  const { theme, box } = options

  ctx.save()

  if (theme.shape === 'circle') clipToCircle(ctx, box)

  if (image) {
    const useFilter = theme.grayscale && supportsFilter()
    if (useFilter) ctx.filter = 'grayscale(100%)'

    // `contain` scales the destination and leaves the source whole; `cover`
    // does the opposite, cropping the source to fill the destination.
    let painted = box
    if (theme.fit === 'contain') {
      painted = containRect(image.width, image.height, box)
      ctx.drawImage(image, painted.x, painted.y, painted.width, painted.height)
    } else {
      const { sx, sy, sw, sh } = coverRect(image.width, image.height, box)
      ctx.drawImage(image, sx, sy, sw, sh, box.x, box.y, box.width, box.height)
    }

    if (useFilter) ctx.filter = 'none'
    if (theme.grayscale && !useFilter) {
      desaturateRegion(ctx, painted, theme.shape === 'circle' ? circleFor(box) : undefined)
    }
  } else if (theme.fallback) {
    ctx.fillStyle = toCSS(parseColor(theme.fallback.background, 'theme.avatar.fallback.background'))
    ctx.fillRect(box.x, box.y, box.width, box.height)

    const initial = options.initial?.trim().charAt(0)
    if (initial) {
      const size = Math.min(box.width, box.height) * 0.22
      ctx.fillStyle = toCSS(parseColor(theme.fallback.color, 'theme.avatar.fallback.color'))
      ctx.font = `${size}px ${options.fallbackFont ?? 'sans-serif'}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(initial.toUpperCase(), box.x + box.width / 2, box.y + box.height / 2)
    }
  }

  ctx.restore()
}

/** Test seam: forces the filter probe to run again. */
export function resetFilterDetectionForTests(): void {
  filterSupported = null
}

/** Test seam: forces `supportsFilter()`'s result, to exercise the fallback path deterministically. */
export function setFilterSupportedForTests(value: boolean): void {
  filterSupported = value
}

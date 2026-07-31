import type { Segment } from '../core/types'
import { createClient } from '../http/client'
import { type Image, loadImage } from '../render/canvasFactory'
import { cachedImage, coalesce, isKnownFailure, rememberFailure, rememberImage } from './cache'

/** Fetches the bytes for a URL. Replaceable so tests never touch the network. */
export type ImageFetcher = (url: string, signal?: AbortSignal) => Promise<Buffer>

const http = createClient({ timeout: 10_000, retry: 2 })

const defaultFetcher: ImageFetcher = async (url, signal) => {
  const response = await http.get(url, signal ? { signal } : {})
  return Buffer.from(await response.arrayBuffer())
}

export interface PrefetchOptions {
  fetcher?: ImageFetcher
  signal?: AbortSignal
  /** Cap on simultaneous downloads. Default 8. */
  concurrency?: number
}

/** Emoji images by URL. A missing key means that one could not be loaded. */
export type EmojiImages = Map<string, Image>

/**
 * Loads every emoji image a set of segments needs, in parallel.
 *
 * Doing this up front is the point: drawing awaits nothing, so a quote with
 * twenty emoji costs one round of parallel requests rather than twenty
 * sequential ones.
 *
 * Failures are not thrown — they are simply absent from the returned map, and
 * the caller decides whether to draw the source text instead.
 */
export async function prefetchEmoji(
  segments: readonly Segment[],
  options: PrefetchOptions = {},
): Promise<EmojiImages> {
  // Keyed by the segment's own url, which is what the renderer looks up; the
  // value is every url worth trying for it. A Misskey shortcode configured
  // across several instances has one per instance.
  const candidates = new Map<string, readonly string[]>()
  for (const segment of segments) {
    if (segment.kind !== 'emoji') continue
    if (candidates.has(segment.url)) continue
    candidates.set(segment.url, alternativesFor(segment))
  }

  const images: EmojiImages = new Map()
  if (candidates.size === 0) return images

  const pending = [...candidates]
  const limit = Math.max(1, options.concurrency ?? 8)

  const workers = Array.from({ length: Math.min(limit, pending.length) }, async () => {
    for (;;) {
      const entry = pending.pop()
      if (entry === undefined) return
      const [key, urls] = entry

      for (const url of urls) {
        const image = await loadEmoji(url, options)
        if (image) {
          images.set(key, image)
          break
        }
      }
    }
  })

  await Promise.all(workers)
  return images
}

/** Every url that might serve a segment, most likely first. */
function alternativesFor(segment: Extract<Segment, { kind: 'emoji' }>): readonly string[] {
  if (segment.source !== 'misskey' || !segment.alternativeUrls?.length) return [segment.url]
  return [segment.url, ...segment.alternativeUrls]
}

/**
 * Loads one emoji image, going through the shared cache.
 *
 * Returns `null` rather than throwing: a missing emoji should degrade the
 * image, not fail the whole render.
 */
export async function loadEmoji(url: string, options: PrefetchOptions = {}): Promise<Image | null> {
  const cached = cachedImage(url)
  if (cached) return cached
  if (isKnownFailure(url)) return null

  return coalesce(url, async () => {
    try {
      const fetcher = options.fetcher ?? defaultFetcher
      const bytes = await fetcher(url, options.signal)
      const image = await loadImage(bytes)
      rememberImage(url, image)
      return image
    } catch {
      rememberFailure(url)
      return null
    }
  })
}

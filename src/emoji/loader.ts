import { readFile } from 'node:fs/promises'
import { pLimit } from 'plimit-lit'
import type { Segment } from '../core/types'
import { createClient } from '../http/client'
import { type Image, loadImage } from '../render/canvasFactory'
import { emojiCache } from './cache'
import { localTwemojiFile } from './twemojiStore'

/** Fetches the bytes for a URL. Replaceable so tests never touch the network. */
export type ImageFetcher = (url: string, signal?: AbortSignal) => Promise<Buffer>

const http = createClient({ timeout: 10_000, retry: 2 })

/**
 * The production fetcher: a locally installed Twemoji first, the CDN second.
 *
 * A file put on disk by `miq install twemoji` is the whole point of that
 * command — it makes rendering work with no network — so it wins over the
 * CDN whenever one exists. An unreadable local file falls through to the
 * network rather than failing, since a corrupt file is not the CDN's fault.
 *
 * The disk check lives here rather than in `loadEmoji` on purpose: tests
 * inject their own fetcher, and must never see the machine's install state.
 */
const defaultFetcher: ImageFetcher = async (url, signal) => {
  const local = localTwemojiFile(url)
  if (local) {
    try {
      return await readFile(local)
    } catch {
      // Fall through to the CDN.
    }
  }
  return http.getBuffer(url, signal)
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

  const limit = pLimit(Math.max(1, options.concurrency ?? 8))

  await Promise.all(
    [...candidates].map(([key, urls]) =>
      limit(async () => {
        for (const url of urls) {
          const image = await loadEmoji(url, options)
          if (image) {
            images.set(key, image)
            break
          }
        }
      }),
    ),
  )

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
  const cached = emojiCache.cached(url)
  if (cached) return cached
  if (emojiCache.isKnownFailure(url)) return null

  return emojiCache.coalesce(url, async () => {
    try {
      const fetcher = options.fetcher ?? defaultFetcher
      const bytes = await fetcher(url, options.signal)
      const image = await loadImage(bytes)
      emojiCache.remember(url, image)
      return image
    } catch {
      emojiCache.rememberFailure(url)
      return null
    }
  })
}

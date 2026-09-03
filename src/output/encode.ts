import { Readable } from 'node:stream'
import { ValidationError } from '../core/errors'
import type { EncodeOptions, OutputFormat } from '../core/types'
import type { Canvas } from '../render/canvasFactory'

/** What the encoder actually understands, after aliases are resolved. */
type CanonicalFormat = 'png' | 'jpeg' | 'webp' | 'avif'

const ALIASES: Record<string, CanonicalFormat> = {
  png: 'png',
  jpeg: 'jpeg',
  jpg: 'jpeg',
  webp: 'webp',
  avif: 'avif',
}

const MIME: Record<CanonicalFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
}

const DEFAULT_QUALITY = 92

/** Resolves a requested format, accepting `'jpg'` for `'jpeg'`. */
export function canonicalFormat(format: OutputFormat): CanonicalFormat {
  const resolved = ALIASES[String(format).toLowerCase()]
  if (!resolved) {
    throw new ValidationError(
      `Unknown format "${format}". Expected one of ${Object.keys(ALIASES).join(', ')}.`,
      { field: 'format' },
    )
  }
  return resolved
}

function quality(options: EncodeOptions | undefined): number {
  const value = options?.quality ?? DEFAULT_QUALITY
  if (!Number.isFinite(value) || value < 1 || value > 100) {
    throw new ValidationError('quality must be between 1 and 100', { field: 'quality' })
  }
  return Math.round(value)
}

export async function encode(
  canvas: Canvas,
  format: OutputFormat = 'png',
  options?: EncodeOptions,
): Promise<Buffer> {
  const resolved = canonicalFormat(format)

  // PNG is lossless, so a quality argument would be meaningless there.
  if (resolved === 'png') return canvas.encode('png')
  // AVIF takes a config object rather than a bare quality number.
  if (resolved === 'avif') return canvas.encode('avif', { quality: quality(options) })
  return canvas.encode(resolved, quality(options))
}

/**
 * The image as a stream.
 *
 * A quote is a small, already-buffered image, so this wraps the buffer rather than genuinely streaming — it exists so callers that want a stream don't have to build one themselves.
 */
export async function encodeStream(
  canvas: Canvas,
  format: OutputFormat = 'png',
  options?: EncodeOptions,
): Promise<Readable> {
  return Readable.from(await encode(canvas, format, options))
}

export async function encodeDataURL(
  canvas: Canvas,
  format: OutputFormat = 'png',
  options?: EncodeOptions,
): Promise<string> {
  const buffer = await encode(canvas, format, options)
  return `data:${MIME[canonicalFormat(format)]};base64,${buffer.toString('base64')}`
}

/** The MIME type a format encodes to. */
export function mimeType(format: OutputFormat): string {
  return MIME[canonicalFormat(format)]
}

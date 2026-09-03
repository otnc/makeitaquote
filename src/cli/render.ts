import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { MiQ } from '../core/MiQ'
import type {
  AvatarSource,
  EncodeOptions,
  LayoutMode,
  OutputFormat,
  QuoteInput,
  ThemePalette,
} from '../core/types'

export interface RenderInput extends QuoteInput {
  theme?: ThemePalette
  layout?: LayoutMode
  scale?: number
  offline?: boolean
  format: OutputFormat
  quality?: number
}

async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks)
}

/** `-` reads stdin; a local file wins over a URL when `value` happens to exist on disk. */
export async function resolveAvatar(value: string): Promise<AvatarSource> {
  if (value === '-') return readStdin()
  if (existsSync(value)) return readFile(value)
  return value
}

/**
 * Same resolution as `resolveAvatar()`, but never returns a bare string — `QuoteInput.watermark` reads a `string` as text, so the remote/data URL case has to be wrapped in a real `URL` to be read as an image instead.
 */
export async function resolveWatermarkImage(value: string): Promise<Buffer | URL> {
  if (value === '-') return readStdin()
  if (existsSync(value)) return readFile(value)
  return new URL(value)
}

/**
 * The real renderer behind `miq render` — builds a `MiQ` from flag values and encodes it. Kept separate from `renderCommand` (in `commands.ts`) so tests can inject a fake here instead of actually drawing a canvas.
 */
export async function renderToBuffer(input: RenderInput): Promise<Buffer> {
  const theme =
    input.theme === undefined && input.layout === undefined
      ? undefined
      : {
          ...(input.theme !== undefined ? { extends: input.theme } : {}),
          ...(input.layout !== undefined ? { layout: input.layout } : {}),
        }

  const miq = new MiQ({
    ...(theme !== undefined ? { theme } : {}),
    ...(input.offline ? { autoFont: false } : {}),
  })

  miq.setFromObject({
    text: input.text,
    avatar: input.avatar,
    username: input.username,
    displayName: input.displayName,
    watermark: input.watermark,
    color: input.color,
  })
  if (input.scale !== undefined) miq.setScale(input.scale)

  const encodeOptions: EncodeOptions | undefined =
    input.quality === undefined ? undefined : { quality: input.quality }
  return miq.toBuffer(input.format, encodeOptions)
}

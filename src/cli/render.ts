import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
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

/** A local file wins over a URL when `value` happens to exist on disk. */
export async function resolveAvatar(value: string): Promise<AvatarSource> {
  if (existsSync(value)) return readFile(value)
  return value
}

/**
 * The real renderer behind `miq render` — builds a `MiQ` from flag values and
 * encodes it. Kept separate from `renderCommand` (in `commands.ts`) so tests
 * can inject a fake here instead of actually drawing a canvas.
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

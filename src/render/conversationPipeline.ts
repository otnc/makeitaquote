import {
  assertHasMessages,
  assertMessageRenderable,
  effectiveConversationName,
  normalizeConversationMessage,
} from '../core/conversation'
import { ValidationError } from '../core/errors'
import type {
  ConversationMessage,
  ConversationOptions,
  ConversationThemeName,
  Segment,
} from '../core/types'
import { prefetchEmoji } from '../emoji/loader'
import { ensureDefaultFonts, reportMissingFonts } from '../font/autoload'
import { resolveFamily } from '../font/registry'
import { DEFAULT_FONT_FAMILIES, FALLBACK_FAMILY } from '../font/sources'
import { type DrawLineOptions, drawLine } from '../text/draw'
import { memoizeMeasurer } from '../text/measure'
import { resolveEmojiSegments, segmentText } from '../text/segment'
import { type Line, wrapSegments } from '../text/wrap'
import { parseColor, toCSS } from '../theme/color'
import { palettes } from '../theme/presets'
import { coverRect, loadAvatar } from './avatar'
import { type Canvas, createCanvas, type Image, type SKRSContext2D } from './canvasFactory'
import { fontString } from './layout'
import { fillText, syntheticBoldWidth } from './textStyle'

const PADDING = 20
const AVATAR_SIZE = 40
const AVATAR_GAP = 12
const NAME_SIZE = 15
const TEXT_SIZE = 16
const LINE_HEIGHT = 1.35
const GROUP_GAP = 16
const MESSAGE_GAP = 4
const NAME_TEXT_GAP = 6
const DESCENDER_PAD = TEXT_SIZE * 0.3
const EMOJI_MARGIN_RATIO = 0.08

/**
 * The one font stack `MiQConversation` draws with.
 *
 * Unlike `MiQ`, there is no per-field font to protect with `coveringStack()`
 * — everything in a conversation uses this same stack, and it already covers
 * Latin and Japanese both, so there is nothing to fall back from.
 */
const FONT_STACK = 'M PLUS Rounded 1c, Noto Sans JP, sans-serif'

interface ConversationPalette {
  background: string
  text: string
  name: string
  avatarFallbackBackground: string
  avatarFallbackColor: string
}

const PALETTES: Record<ConversationThemeName, ConversationPalette> = {
  dark: {
    background: palettes.dark.background,
    text: palettes.dark.text,
    name: palettes.dark.text,
    avatarFallbackBackground: palettes.dark.avatarFallback.background,
    avatarFallbackColor: palettes.dark.avatarFallback.color,
  },
  light: {
    background: palettes.light.background,
    text: palettes.light.text,
    name: palettes.light.text,
    avatarFallbackBackground: palettes.light.avatarFallback.background,
    avatarFallbackColor: palettes.light.avatarFallback.color,
  },
}

type DrawOp =
  | { kind: 'avatar'; x: number; y: number; image: Image | null; initial: string }
  | { kind: 'name'; x: number; y: number; text: string }
  | { kind: 'line'; x: number; y: number; line: Line }

/**
 * Renders a conversation: several messages stacked as one image, each with
 * its own avatar, name and wrapped text — a Discord message log, not a quote.
 *
 * Two passes, same reason `MiQ` fetches everything before drawing: the final
 * height depends on how every message wraps, which cannot be known until
 * text is measured, so a throwaway canvas measures and lays everything out
 * first, then the real canvas (now that its height is known) is painted from
 * that layout.
 */
export async function renderConversation(
  input: readonly ConversationMessage[],
  options: ConversationOptions = {},
): Promise<Canvas> {
  const messages = input.map(normalizeConversationMessage)
  assertHasMessages(messages)
  messages.forEach(assertMessageRenderable)

  const width = options.width ?? 600
  if (!Number.isFinite(width) || width <= 0) {
    throw new ValidationError('width must be a positive number', { field: 'width' })
  }

  const colors = PALETTES[options.theme ?? 'dark']

  const perMessageSegments = messages.map((message) =>
    segmentText(message.text, options.misskey ? { misskey: options.misskey } : {}),
  )

  const [images] = await Promise.all([
    prefetchEmoji(perMessageSegments.flat(), options.signal ? { signal: options.signal } : {}),
    prepareFonts(options),
  ])

  const avatars = await Promise.all(
    messages.map((message) =>
      loadAvatar(message.avatar, options.signal ? { signal: options.signal } : {}),
    ),
  )

  const onMissing = options.onAssetError ?? 'text'
  const resolvedPerMessage = perMessageSegments.map((segments) =>
    resolveEmojiSegments(segments, (url) => images.get(url) !== undefined, onMissing),
  )

  const family = resolveFamily(FONT_STACK) ?? FALLBACK_FAMILY
  const contentX = PADDING + AVATAR_SIZE + AVATAR_GAP
  const textColumnWidth = Math.max(1, width - contentX - PADDING)

  // Pass 1: layout. The scratch canvas exists only so measureText has a
  // context to run on — nothing here is ever drawn.
  const scratch = createCanvas(Math.max(1, Math.round(width)), 1)
  const measureCtx = scratch.getContext('2d')
  measureCtx.font = fontString('normal', TEXT_SIZE, family)
  const measurer = memoizeMeasurer(measureCtx)
  const metrics = { fontSize: TEXT_SIZE, sideMarginRatio: EMOJI_MARGIN_RATIO }
  const boldStroke = syntheticBoldWidth(measureCtx, 'bold', family, NAME_SIZE)

  const ops: DrawOp[] = []
  let cursorY = PADDING
  let previousUsername: string | null = null

  messages.forEach((message, index) => {
    const grouped = previousUsername !== null && previousUsername === message.username
    const rowTop = cursorY + (index === 0 ? 0 : grouped ? MESSAGE_GAP : GROUP_GAP)

    const lines = wrapSegments(resolvedPerMessage[index] as Segment[], {
      maxWidth: textColumnWidth,
      measurer,
      metrics,
      locale: 'ja',
      phraseBreak: true,
    })

    let textStartY: number
    if (grouped) {
      textStartY = rowTop + TEXT_SIZE
    } else {
      ops.push({
        kind: 'avatar',
        x: PADDING,
        y: rowTop,
        image: avatars[index] as Image | null,
        initial: effectiveConversationName(message).trim().charAt(0).toUpperCase(),
      })
      const nameY = rowTop + NAME_SIZE
      ops.push({ kind: 'name', x: contentX, y: nameY, text: effectiveConversationName(message) })
      textStartY = nameY + NAME_TEXT_GAP + TEXT_SIZE
    }

    let lineY = textStartY
    let lastBaseline = textStartY
    for (const line of lines) {
      ops.push({ kind: 'line', x: contentX, y: lineY, line })
      lastBaseline = lineY
      lineY += TEXT_SIZE * LINE_HEIGHT
    }

    const contentBottom = lastBaseline + DESCENDER_PAD
    const avatarBottom = grouped ? 0 : rowTop + AVATAR_SIZE
    cursorY = Math.max(contentBottom, avatarBottom)
    previousUsername = message.username
  })

  const height = Math.max(1, Math.round(cursorY + PADDING))

  // Pass 2: paint, using the layout pass 1 computed.
  const canvas = createCanvas(Math.round(width), height)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = toCSS(parseColor(colors.background, 'theme.background'))
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const lineOptions: DrawLineOptions = {
    fontSize: TEXT_SIZE,
    sideMarginRatio: EMOJI_MARGIN_RATIO,
    topMarginRatio: 0.1,
    images,
    onMissing,
    baseWeight: 'normal',
    family,
  }

  for (const op of ops) {
    if (op.kind === 'avatar') {
      drawCircleAvatar(ctx, op.image, op.x, op.y, AVATAR_SIZE, op.initial, colors, family)
    } else if (op.kind === 'name') {
      ctx.font = fontString('bold', NAME_SIZE, family)
      ctx.fillStyle = toCSS(parseColor(colors.name, 'theme.name'))
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      fillText(ctx, op.text, op.x, op.y, boldStroke)
    } else {
      ctx.font = fontString('normal', TEXT_SIZE, family)
      ctx.fillStyle = toCSS(parseColor(colors.text, 'theme.text'))
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      drawLine(ctx, op.line, op.x, op.y, lineOptions)
    }
  }

  return canvas
}

/**
 * Clips to a circle and draws the avatar (or a fallback tile with an
 * initial) inside it — the same idea as the main renderer's fallback tile,
 * just circular and self-contained rather than sharing `AvatarTheme`, which
 * this has no use for.
 */
function drawCircleAvatar(
  ctx: SKRSContext2D,
  image: Image | null,
  x: number,
  y: number,
  size: number,
  initial: string,
  colors: ConversationPalette,
  family: string,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()

  if (image) {
    const { sx, sy, sw, sh } = coverRect(image.width, image.height, {
      x,
      y,
      width: size,
      height: size,
    })
    ctx.drawImage(image, sx, sy, sw, sh, x, y, size, size)
  } else {
    ctx.fillStyle = toCSS(
      parseColor(colors.avatarFallbackBackground, 'theme.avatar.fallback.background'),
    )
    ctx.fillRect(x, y, size, size)

    if (initial) {
      ctx.fillStyle = toCSS(parseColor(colors.avatarFallbackColor, 'theme.avatar.fallback.color'))
      ctx.font = `${size * 0.45}px ${family}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(initial, x + size / 2, y + size / 2)
    }
  }

  ctx.restore()
}

/**
 * Makes sure the one font stack `MiQConversation` uses is available.
 *
 * Simpler than the main renderer's `prepareFonts`: there is exactly one
 * stack, always with a Japanese-capable fallback, so it is fetched
 * unconditionally rather than only when the text turns out to need it.
 */
async function prepareFonts(options: ConversationOptions): Promise<void> {
  const autoFont = options.autoFont ?? true
  if (autoFont !== false) {
    const autoOptions = {
      ...(typeof autoFont === 'object' ? autoFont : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    }
    await ensureDefaultFonts(autoOptions)
  }

  const missing = DEFAULT_FONT_FAMILIES.filter((family) => resolveFamily(family) === null)
  reportMissingFonts(missing, options)
}

import { createCanvas } from '../render/canvasFactory'

let drawable: boolean | null = null

/**
 * Whether this machine can draw text at all.
 *
 * Tests run with `autoFont: false` so they never download a 3MB font, which leaves them at the mercy of the system's own fonts — and a bare container (Alpine, most notably) genuinely has none. There, every glyph measures zero and paints nothing, so any assertion about pixels or about text overflowing is meaningless rather than wrong.
 *
 * Assertions that depend on glyphs existing are skipped when this is false. Everything else — layout maths, encoding, the native binding loading at all — still runs, which is what the Alpine job is really there to prove.
 */
export function hasDrawableFont(): boolean {
  if (drawable !== null) return drawable

  try {
    const ctx = createCanvas(1, 1).getContext('2d')
    ctx.font = '100px sans-serif'
    drawable = ctx.measureText('M').width > 0
  } catch {
    drawable = false
  }

  return drawable
}

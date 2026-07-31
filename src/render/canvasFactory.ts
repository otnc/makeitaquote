/**
 * The single place `@napi-rs/canvas` is imported.
 *
 * Keeping it to one module means the `makeitaquote/api` entry can be checked
 * for the absence of this import, which is what guarantees that requiring the
 * API client never loads the native binding.
 */
export {
  Canvas,
  createCanvas,
  GlobalFonts,
  Image,
  loadImage,
  type SKRSContext2D,
} from '@napi-rs/canvas'

/**
 * The single place `@napi-rs/canvas` is imported.
 *
 * Keeping it to one module means what pulls in the native binding — and what the built output must therefore keep external rather than bundle — is one import statement rather than a search.
 */
export {
  Canvas,
  createCanvas,
  GlobalFonts,
  Image,
  loadImage,
  type SKRSContext2D,
} from '@napi-rs/canvas'

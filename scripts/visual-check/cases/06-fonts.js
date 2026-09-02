import { avatars, base } from '../fixtures.js'
import { FONT_CATALOGUE } from '../library.js'

export const group = '06-fonts'

export const cases = FONT_CATALOGUE.map((family) => ({
  name: family,
  build: () =>
    base()
      .setText(`${family}\n映える引用 Quote 123`)
      .setAvatar(avatars.illustration)
      .setTheme({ text: { font: `${family}, Noto Sans JP, sans-serif` } }),
  network: true,
}))

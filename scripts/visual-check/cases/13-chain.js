import { avatars, base, text } from '../fixtures.js'
import { MiQ, MiQChain } from '../library.js'

export const group = '13-chain'

export const cases = [
  {
    name: 'dark (default) — original on top, reply below',
    build: () =>
      new MiQChain(
        base().setText(text.ja).setAvatar(avatars.illustration),
        new MiQ().setUsername('ねこ').setText(text.en),
      ),
    note: "default pairing: top's avatar on the right, bottom's on the left",
  },
  {
    name: 'flip — swaps which side each avatar sits on',
    build: () =>
      new MiQChain(
        base().setText(text.short).setAvatar(avatars.illustration),
        new MiQ().setUsername('ねこ').setText('それへの返信'),
        { flip: true },
      ),
  },
  {
    name: 'each half keeps its own theme',
    build: () =>
      new MiQChain(
        base().setText(text.ja).setAvatar(avatars.illustration).setTheme('light'),
        new MiQ().setUsername('ねこ').setText(text.en).setAvatar(avatars.photo),
      ),
    note: 'MiQChain only decides avatar side — theme, color, bold and markdown stay per-half',
  },
]

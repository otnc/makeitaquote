// --- 13-chain: MiQChain, a reply/quote pair stacked as one image ----------

export default function registerChain(add, { MiQ, MiQChain, base, avatars, text }) {
  add(
    '13-chain',
    'dark (default) — original on top, reply below',
    () =>
      new MiQChain(
        base().setText(text.ja).setAvatar(avatars.illustration),
        new MiQ().setUsername('ねこ').setText(text.en),
      ),
    { note: "default pairing: top's avatar on the right, bottom's on the left" },
  )
  add(
    '13-chain',
    'flip — swaps which side each avatar sits on',
    () =>
      new MiQChain(
        base().setText(text.short).setAvatar(avatars.illustration),
        new MiQ().setUsername('ねこ').setText('それへの返信'),
        { flip: true },
      ),
  )
  add(
    '13-chain',
    'each half keeps its own theme',
    () =>
      new MiQChain(
        base().setText(text.ja).setAvatar(avatars.illustration).setTheme('light'),
        new MiQ().setUsername('ねこ').setText(text.en).setAvatar(avatars.photo),
      ),
    { note: 'MiQChain only decides avatar side — theme, color, bold and markdown stay per-half' },
  )
}

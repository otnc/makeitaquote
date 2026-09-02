// --- 06-fonts: catalogue families ---------------------------------------------

export default function registerFonts(add, { base, avatars, FONT_CATALOGUE }) {
  for (const family of FONT_CATALOGUE) {
    add(
      '06-fonts',
      family,
      () =>
        base()
          .setText(`${family}\n映える引用 Quote 123`)
          .setAvatar(avatars.illustration)
          .setTheme({ text: { font: `${family}, Noto Sans JP, sans-serif` } }),
      { network: true },
    )
  }
}

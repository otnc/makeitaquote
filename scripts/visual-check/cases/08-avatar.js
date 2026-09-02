// --- 08-avatar: sources and fallbacks -----------------------------------------

export default function registerAvatar(add, { base, text, avatars }) {
  add('08-avatar', 'illustration (png with alpha)', () =>
    base().setText(text.ja).setAvatar(avatars.illustration),
  )
  add('08-avatar', 'photo (jpg)', () => base().setText(text.ja).setAvatar(avatars.photo))
  add('08-avatar', 'color kept', () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.photo)
      .setTheme({ avatar: { grayscale: false } }),
  )
  add('08-avatar', 'from a remote url', () => base().setText(text.ja).setAvatar(avatars.url), {
    network: true,
  })
  add('08-avatar', 'from a Buffer', () => base().setText(text.ja).setAvatar(avatars.buffer))
  add('08-avatar', 'none — fallback tile with initial', () =>
    base().setText(text.ja).setAvatar(avatars.none),
  )
  add('08-avatar', 'unreachable url — same fallback', () =>
    base().setText(text.ja).setAvatar(avatars.broken),
  )
  add('08-avatar', 'no fallback tile at all', () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.none)
      .setTheme({ avatar: { fallback: null } }),
  )
}

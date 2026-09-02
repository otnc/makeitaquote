// --- 04-emoji: the three sources ---------------------------------------------

export default function registerEmoji(add, { base, misskeyBase, text, avatars, misskeyEmoji }) {
  add(
    '04-emoji',
    'twemoji, including ZWJ and skin tone',
    () => base().setText(text.twemoji).setAvatar(avatars.illustration),
    { network: true },
  )
  add(
    '04-emoji',
    'discord custom emoji',
    () => base().setText(text.discord).setAvatar(avatars.illustration),
    { network: true, note: 'real ids from assets/discordemoji.json' },
  )
  add(
    '04-emoji',
    'misskey custom emoji',
    () => misskeyBase().setText(text.misskey).setAvatar(avatars.illustration),
    { network: true, note: `instance: ${misskeyEmoji.instance}` },
  )
  add(
    '04-emoji',
    'all three together',
    () => misskeyBase().setText(text.allEmoji).setAvatar(avatars.illustration),
    { network: true },
  )
  add(
    '04-emoji',
    'misskey off — drawn as plain text',
    () => base().setText(text.misskey).setAvatar(avatars.illustration),
    { note: 'Misskey emoji only resolve when an instance is configured' },
  )
  add(
    '04-emoji',
    'unfetchable emoji falls back to its source text',
    () => base().setText('これ <:nope:123456789012345678> です').setAvatar(avatars.illustration),
    { network: true },
  )
}

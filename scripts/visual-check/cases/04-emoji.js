import { avatars, base, misskeyBase, misskeyEmoji, text } from '../fixtures.js'

export const group = '04-emoji'

export const cases = [
  {
    name: 'twemoji, including ZWJ and skin tone',
    build: () => base().setText(text.twemoji).setAvatar(avatars.illustration),
    network: true,
  },
  {
    name: 'discord custom emoji',
    build: () => base().setText(text.discord).setAvatar(avatars.illustration),
    network: true,
    note: 'real ids from assets/discordemoji.json',
  },
  {
    name: 'misskey custom emoji',
    build: () => misskeyBase().setText(text.misskey).setAvatar(avatars.illustration),
    network: true,
    note: `instance: ${misskeyEmoji.instance}`,
  },
  {
    name: 'all three together',
    build: () => misskeyBase().setText(text.allEmoji).setAvatar(avatars.illustration),
    network: true,
  },
  {
    name: 'misskey off — drawn as plain text',
    build: () => base().setText(text.misskey).setAvatar(avatars.illustration),
    note: 'Misskey emoji only resolve when an instance is configured',
  },
  {
    name: 'unfetchable emoji falls back to its source text',
    build: () =>
      base().setText('これ <:nope:123456789012345678> です').setAvatar(avatars.illustration),
    network: true,
  },
]

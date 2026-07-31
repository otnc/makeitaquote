import type { MessageLike } from '../core/types'

/** discord.js v14: Pomelo username, global name, guild member with a nickname. */
export function v14Message(overrides: Partial<MessageLike> = {}): MessageLike {
  return {
    content: 'Hello World!',
    author: {
      username: 'otoneko.',
      globalName: '音猫｡',
      discriminator: '0',
      displayAvatarURL: (options) => urlFor('user', options),
    },
    member: {
      displayName: 'ねこ',
      nickname: 'ねこ',
      displayAvatarURL: (options) => urlFor('member', options),
    },
    ...overrides,
  }
}

/** discord.js v13 / selfbot: legacy discriminator, no global name. */
export function v13Message(overrides: Partial<MessageLike> = {}): MessageLike {
  return {
    content: 'Hello World!',
    author: {
      username: 'otoneko',
      discriminator: '6666',
      displayAvatarURL: (options) => urlFor('user', options),
    },
    member: null,
    ...overrides,
  }
}

/** An object that only implements the bare minimum of `MessageLike`. */
export function minimalMessage(overrides: Partial<MessageLike> = {}): MessageLike {
  return {
    content: 'Hello World!',
    author: { username: 'someone' },
    ...overrides,
  }
}

function urlFor(who: string, options: unknown): string {
  const opts = (options ?? {}) as { extension?: string; size?: number }
  const extension = opts.extension ?? 'webp'
  const size = opts.size ?? 4096
  return `https://cdn.discordapp.com/avatars/1/${who}.${extension}?size=${size}`
}

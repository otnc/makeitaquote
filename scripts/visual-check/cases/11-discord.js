import { avatars, discordEmoji, text } from '../fixtures.js'
import { MiQ } from '../library.js'

export const group = '11-discord'

const markdownSample = [
  '**このパッケージ**は自分で*太字*を解除しません',
  '- リストの記号も',
  '-# こういう小さい文字も',
].join('\n')

const mentionMessage = {
  content: 'いってらっしゃい <@1>、今日は <#2> で <@&3> の集まりです',
  author: { username: 'someone' },
  mentions: {
    users: new Map([['1', { username: 'otoneko' }]]),
    channels: new Map([['2', { name: '雑談' }]]),
    roles: new Map([['3', { name: 'メンバー' }]]),
  },
}

export const cases = [
  {
    name: 'from a discord.js v14 message',
    build: () =>
      new MiQ().setFromMessage({
        content: `おはよう ${discordEmoji[0]}`,
        author: {
          username: 'otoneko.',
          globalName: '音猫｡',
          discriminator: '0',
          displayAvatarURL: () => avatars.url,
        },
        member: { displayName: 'ねこ', displayAvatarURL: () => avatars.url },
      }),
    network: true,
  },
  {
    name: 'from a legacy message (discriminator kept)',
    build: () =>
      new MiQ().setFromMessage({
        content: text.ja,
        author: { username: 'otoneko', discriminator: '6666', displayAvatarURL: () => avatars.url },
        member: null,
      }),
    network: true,
  },
  {
    name: 'from a minimal message (no avatar)',
    build: () => new MiQ().setFromMessage({ content: text.ja, author: { username: 'someone' } }),
  },
  {
    name: 'markdown quoted as written (default)',
    build: () =>
      new MiQ().setFromMessage({ content: markdownSample, author: { username: 'someone' } }),
    note: 'stripDiscordMarkdown defaults to false — compare with the next card',
  },
  {
    name: 'stripDiscordMarkdown: true',
    build: () =>
      new MiQ().setFromMessage(
        { content: markdownSample, author: { username: 'someone' } },
        { stripDiscordMarkdown: true },
      ),
  },
  {
    name: 'mentions resolved (default)',
    build: () => new MiQ().setFromMessage(mentionMessage),
    note: 'resolveMentions defaults to true — compare with the next card',
  },
  {
    name: 'resolveMentions: false',
    build: () => new MiQ().setFromMessage(mentionMessage, { resolveMentions: false }),
  },
  {
    name: 'slash commands, timestamps and navigation tabs',
    build: () =>
      new MiQ().setFromMessage({
        content: '</remind set:1> で <t:1618935630:F> に、詳しくは <id:guide> を見てね',
        author: { username: 'someone' },
      }),
    note: 'these carry everything they need in the token — no lookup involved',
  },
]

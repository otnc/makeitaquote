// --- 11-discord: what a bot actually produces -------------------------------

export default function registerDiscord(add, { MiQ, text, avatars, discordEmoji }) {
  add(
    '11-discord',
    'from a discord.js v14 message',
    () =>
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
    { network: true },
  )
  add(
    '11-discord',
    'from a legacy message (discriminator kept)',
    () =>
      new MiQ().setFromMessage({
        content: text.ja,
        author: { username: 'otoneko', discriminator: '6666', displayAvatarURL: () => avatars.url },
        member: null,
      }),
    { network: true },
  )
  add('11-discord', 'from a minimal message (no avatar)', () =>
    new MiQ().setFromMessage({ content: text.ja, author: { username: 'someone' } }),
  )

  const markdownSample = [
    '**このパッケージ**は自分で*太字*を解除しません',
    '- リストの記号も',
    '-# こういう小さい文字も',
  ].join('\n')

  add(
    '11-discord',
    'markdown quoted as written (default)',
    () =>
      new MiQ().setFromMessage({
        content: markdownSample,
        author: { username: 'someone' },
      }),
    { note: 'stripDiscordMarkdown defaults to false — compare with the next card' },
  )
  add('11-discord', 'stripDiscordMarkdown: true', () =>
    new MiQ().setFromMessage(
      { content: markdownSample, author: { username: 'someone' } },
      { stripDiscordMarkdown: true },
    ),
  )
  add(
    '11-discord',
    'mentions resolved (default)',
    () =>
      new MiQ().setFromMessage({
        content: 'いってらっしゃい <@1>、今日は <#2> で <@&3> の集まりです',
        author: { username: 'someone' },
        mentions: {
          users: new Map([['1', { username: 'otoneko' }]]),
          channels: new Map([['2', { name: '雑談' }]]),
          roles: new Map([['3', { name: 'メンバー' }]]),
        },
      }),
    { note: 'resolveMentions defaults to true — compare with the next card' },
  )
  add('11-discord', 'resolveMentions: false', () =>
    new MiQ().setFromMessage(
      {
        content: 'いってらっしゃい <@1>、今日は <#2> で <@&3> の集まりです',
        author: { username: 'someone' },
        mentions: {
          users: new Map([['1', { username: 'otoneko' }]]),
          channels: new Map([['2', { name: '雑談' }]]),
          roles: new Map([['3', { name: 'メンバー' }]]),
        },
      },
      { resolveMentions: false },
    ),
  )

  add(
    '11-discord',
    'slash commands, timestamps and navigation tabs',
    () =>
      new MiQ().setFromMessage({
        content: '</remind set:1> で <t:1618935630:F> に、詳しくは <id:guide> を見てね',
        author: { username: 'someone' },
      }),
    { note: 'these carry everything they need in the token — no lookup involved' },
  )
}

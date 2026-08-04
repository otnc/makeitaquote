import { describe, expect, it } from 'vitest'
import { minimalMessage, v13Message, v14Message } from '../__fixtures__/messages'
import { ValidationError } from './errors'
import { fromMessage } from './source'

describe('fromMessage', () => {
  it('reads content, member nickname and member avatar from a v14 message', () => {
    const quote = fromMessage(v14Message())

    expect(quote.text).toBe('Hello World!')
    expect(quote.username).toBe('otoneko.')
    expect(quote.displayName).toBe('ねこ')
    expect(quote.avatar).toBe('https://cdn.discordapp.com/avatars/1/member.png?size=512')
  })

  it('quotes the content exactly as written by default', () => {
    const quote = fromMessage(v14Message({ content: '**bold** message' }))

    expect(quote.text).toBe('**bold** message')
  })

  it('strips markdown when opted in', () => {
    const quote = fromMessage(v14Message({ content: '**bold** message' }), {
      stripDiscordMarkdown: true,
    })

    expect(quote.text).toBe('bold message')
  })

  it('resolves mentions by default', () => {
    const quote = fromMessage(
      v14Message({
        content: 'hi <@1>',
        mentions: { users: new Map([['1', { username: 'otoneko' }]]) },
      }),
    )

    expect(quote.text).toBe('hi @otoneko')
  })

  it('leaves mentions as written when resolveMentions is false', () => {
    const quote = fromMessage(
      v14Message({
        content: 'hi <@1>',
        mentions: { users: new Map([['1', { username: 'otoneko' }]]) },
      }),
      { resolveMentions: false },
    )

    expect(quote.text).toBe('hi <@1>')
  })

  it('is a no-op when the message has no mentions field', () => {
    expect(fromMessage(v14Message({ content: 'hi <@1>' })).text).toBe('hi <@1>')
  })

  it('resolves mentions before stripping markdown', () => {
    const quote = fromMessage(
      v14Message({
        content: '**hi** <@1>',
        mentions: { users: new Map([['1', { username: 'otoneko' }]]) },
      }),
      { stripDiscordMarkdown: true },
    )

    expect(quote.text).toBe('hi @otoneko')
  })

  it('keeps the discriminator for legacy accounts', () => {
    expect(fromMessage(v13Message()).username).toBe('otoneko#6666')
  })

  it('drops the discriminator when it is the migrated placeholder', () => {
    const quote = fromMessage(v14Message({ author: { username: 'otoneko.', discriminator: '0' } }))

    expect(quote.username).toBe('otoneko.')
  })

  it('falls back to the author avatar when there is no member', () => {
    expect(fromMessage(v13Message()).avatar).toBe(
      'https://cdn.discordapp.com/avatars/1/user.png?size=512',
    )
  })

  it('prefers globalName over username when no member is present', () => {
    const quote = fromMessage(
      v13Message({ author: { username: 'otoneko', globalName: '音猫｡', discriminator: '0' } }),
    )

    expect(quote.displayName).toBe('音猫｡')
  })

  it('accepts the snake_case global_name used by raw gateway payloads', () => {
    const quote = fromMessage(
      v13Message({ author: { username: 'otoneko', global_name: '音猫｡', discriminator: '0' } }),
    )

    expect(quote.displayName).toBe('音猫｡')
  })

  it('falls back to the username when nothing else names the author', () => {
    const quote = fromMessage(minimalMessage())

    expect(quote.displayName).toBe('someone')
    expect(quote.avatar).toBeNull()
  })

  it('survives a displayAvatarURL that rejects options', () => {
    const quote = fromMessage(
      minimalMessage({
        author: {
          username: 'someone',
          displayAvatarURL: (options) => {
            if (options !== undefined) throw new TypeError('no options accepted')
            return 'https://example.test/a.png'
          },
        },
      }),
    )

    expect(quote.avatar).toBe('https://example.test/a.png')
  })

  it('rejects objects that are not messages', () => {
    expect(() => fromMessage(null)).toThrow(ValidationError)
    expect(() => fromMessage({})).toThrow(ValidationError)
    expect(() => fromMessage({ content: 'hi' })).toThrow(ValidationError)
  })
})

describe('choosing which avatar', () => {
  it('prefers the guild avatar by default', () => {
    expect(fromMessage(v14Message()).avatar).toContain('member')
  })

  it('takes the account avatar when asked', () => {
    expect(fromMessage(v14Message(), { avatar: 'global' }).avatar).toContain('user')
  })

  it('falls back to the account avatar when the member has none', () => {
    const message = v14Message({ member: { displayName: 'ねこ' } })

    expect(fromMessage(message, { avatar: 'guild' }).avatar).toContain('user')
  })

  it('falls back to the guild avatar when the account has none', () => {
    const message = v14Message({
      author: { username: 'otoneko.', discriminator: '0' },
    })

    expect(fromMessage(message, { avatar: 'global' }).avatar).toContain('member')
  })
})

describe('choosing which name', () => {
  const withBoth = () =>
    v14Message({
      author: {
        username: 'otoneko.',
        globalName: '音猫｡',
        discriminator: '0',
        displayAvatarURL: () => 'https://example.test/u.png',
      },
      member: { nickname: 'ねこ', displayName: 'ねこ' },
    })

  it('prefers the server nickname by default', () => {
    expect(fromMessage(withBoth()).displayName).toBe('ねこ')
  })

  it('takes the global name when asked', () => {
    expect(fromMessage(withBoth(), { name: 'global' }).displayName).toBe('音猫｡')
  })

  it('falls back to the global name when there is no nickname', () => {
    const message = v14Message({
      author: { username: 'otoneko.', globalName: '音猫｡', discriminator: '0' },
      member: null,
    })

    expect(fromMessage(message, { name: 'nickname' }).displayName).toBe('音猫｡')
  })

  it('falls back to the nickname when there is no global name', () => {
    const message = v14Message({
      author: { username: 'otoneko.', discriminator: '0' },
      member: { nickname: 'ねこ' },
    })

    expect(fromMessage(message, { name: 'global' }).displayName).toBe('ねこ')
  })

  it('ends at the username when the message has neither', () => {
    expect(fromMessage(minimalMessage(), { name: 'global' }).displayName).toBe('someone')
  })

  it('does not treat displayName as a nickname when none is set', () => {
    // discord.js reports displayName as "nickname, or the global name", so a
    // member with no nickname must not shadow the global name.
    const message = v14Message({
      author: { username: 'otoneko.', globalName: '音猫｡', discriminator: '0' },
      member: { displayName: '音猫｡' },
    })

    expect(fromMessage(message, { name: 'global' }).displayName).toBe('音猫｡')
  })
})

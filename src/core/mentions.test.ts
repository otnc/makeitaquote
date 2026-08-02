import { describe, expect, it } from 'vitest'
import { resolveMentions } from './mentions'
import type { MessageLike } from './types'

function message(content: string, mentions?: MessageLike['mentions']): MessageLike {
  return { content, author: { username: 'someone' }, mentions }
}

describe('resolveMentions', () => {
  it('leaves a name mention untouched when the message has no mentions field', () => {
    expect(resolveMentions('hi <@1>', message('hi <@1>'))).toBe('hi <@1>')
  })

  it('resolves a user mention from mentions.members, preferring the nickname', () => {
    const msg = message('hi <@1>', {
      members: new Map([['1', { nickname: 'ねこ', displayName: 'otoneko' }]]),
    })

    expect(resolveMentions(msg.content, msg)).toBe('hi @ねこ')
  })

  it('falls back to displayName when there is no nickname', () => {
    const msg = message('hi <@1>', {
      members: new Map([['1', { nickname: null, displayName: 'otoneko' }]]),
    })

    expect(resolveMentions(msg.content, msg)).toBe('hi @otoneko')
  })

  it('falls back to mentions.users when there is no member', () => {
    const msg = message('hi <@1>', {
      users: new Map([['1', { username: 'otoneko' }]]),
    })

    expect(resolveMentions(msg.content, msg)).toBe('hi @otoneko')
  })

  it('resolves the nickname-mention form <@!id> the same way', () => {
    const msg = message('hi <@!1>', {
      users: new Map([['1', { username: 'otoneko' }]]),
    })

    expect(resolveMentions(msg.content, msg)).toBe('hi @otoneko')
  })

  it('resolves a channel mention', () => {
    const msg = message('see <#2>', {
      channels: new Map([['2', { name: 'general' }]]),
    })

    expect(resolveMentions(msg.content, msg)).toBe('see #general')
  })

  it('resolves a role mention', () => {
    const msg = message('hey <@&3>', {
      roles: new Map([['3', { name: 'mods' }]]),
    })

    expect(resolveMentions(msg.content, msg)).toBe('hey @mods')
  })

  it('leaves a token exactly as written when its target is not in mentions', () => {
    const msg = message('hi <@404>', { users: new Map() })

    expect(resolveMentions(msg.content, msg)).toBe('hi <@404>')
  })

  it('resolves several mentions of different kinds in one message', () => {
    const msg = message('<@1> mentioned <#2> and <@&3>', {
      users: new Map([['1', { username: 'otoneko' }]]),
      channels: new Map([['2', { name: 'general' }]]),
      roles: new Map([['3', { name: 'mods' }]]),
    })

    expect(resolveMentions(msg.content, msg)).toBe('@otoneko mentioned #general and @mods')
  })

  it('does not touch @everyone or @here — Discord writes those as plain text already', () => {
    expect(resolveMentions('@everyone hi @here', message('@everyone hi @here'))).toBe(
      '@everyone hi @here',
    )
  })

  describe('slash commands', () => {
    it('resolves one, dropping the id it carries', () => {
      expect(resolveMentions('try </ping:123>', message('try </ping:123>'))).toBe('try /ping')
    })

    it('keeps a sub-command, and a group plus sub-command', () => {
      expect(resolveMentions('</config set:1>', message(''))).toBe('/config set')
      expect(resolveMentions('</a b c:1>', message(''))).toBe('/a b c')
    })

    it('resolves without any mentions Collections — the name is in the token', () => {
      expect(resolveMentions('</ping:1>', message('</ping:1>'))).toBe('/ping')
    })
  })

  describe('guild navigation', () => {
    it('names each tab Discord defines', () => {
      const nav = (raw: string) => resolveMentions(raw, message(raw))

      expect(nav('<id:browse>')).toBe('Browse Channels')
      expect(nav('<id:customize>')).toBe('Channels & Roles')
      expect(nav('<id:guide>')).toBe('Server Guide')
      expect(nav('<id:linked-roles>')).toBe('Linked Roles')
    })

    it('leaves an unknown tab exactly as written', () => {
      expect(resolveMentions('<id:nonsense>', message(''))).toBe('<id:nonsense>')
    })
  })

  describe('timestamps', () => {
    // 2021-04-20T16:20:30Z — the example from Discord's own docs.
    const AT = 1618935630
    const at = (raw: string, options = {}) => resolveMentions(raw, message(''), options)

    it('renders each style the way Discord documents it', () => {
      expect(at(`<t:${AT}:t>`)).toBe('16:20')
      expect(at(`<t:${AT}:T>`)).toBe('16:20:30')
      expect(at(`<t:${AT}:d>`)).toBe('20/04/2021')
      expect(at(`<t:${AT}:D>`)).toBe('20 April 2021')
      expect(at(`<t:${AT}:F>`)).toBe('Tuesday, 20 April 2021 at 16:20')
    })

    it('treats a bare timestamp as the f style, as Discord does', () => {
      expect(at(`<t:${AT}>`)).toBe(at(`<t:${AT}:f>`))
    })

    it('renders in UTC unless a zone is given', () => {
      expect(at(`<t:${AT}:t>`)).toBe('16:20')
      expect(at(`<t:${AT}:t>`, { timeZone: 'Asia/Tokyo' })).toBe('01:20')
    })

    it('honours a locale', () => {
      expect(at(`<t:${AT}:D>`, { locale: 'ja-JP', timeZone: 'Asia/Tokyo' })).toBe('2021年4月21日')
    })

    it('keeps R relative — that is what the screen said', () => {
      const now = new Date((AT + 86_400 * 70) * 1000)

      expect(at(`<t:${AT}:R>`, { now })).toBe('2 months ago')
    })

    it('handles a time still to come', () => {
      const now = new Date((AT - 3600) * 1000)

      expect(at(`<t:${AT}:R>`, { now })).toBe('in 1 hour')
    })

    it('leaves an unknown style as written, rather than guessing', () => {
      expect(at(`<t:${AT}:Z>`)).toBe(`<t:${AT}:Z>`)
    })
  })
})

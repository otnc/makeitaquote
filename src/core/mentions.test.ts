import { describe, expect, it } from 'vitest'
import { resolveMentions } from './mentions'
import type { MessageLike } from './types'

function message(content: string, mentions?: MessageLike['mentions']): MessageLike {
  return { content, author: { username: 'someone' }, mentions }
}

describe('resolveMentions', () => {
  it('leaves content untouched when the message has no mentions field', () => {
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
})

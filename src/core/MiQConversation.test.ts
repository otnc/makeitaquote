import { describe, expect, it } from 'vitest'
import { v14Message } from '../__fixtures__/messages'
import { MiQConversation } from './MiQConversation'

describe('MiQConversation', () => {
  it('returns itself from every setter, so calls chain', () => {
    const conv = new MiQConversation()

    expect(conv.addMessage({ username: 'a', text: 'hi' })).toBe(conv)
    expect(conv.setMessages([{ username: 'a', text: 'hi' }])).toBe(conv)
    expect(conv.setTheme('light')).toBe(conv)
    expect(conv.setFromMessages([v14Message()])).toBe(conv)
  })

  it('addMessage appends', () => {
    const conv = new MiQConversation()
      .addMessage({ username: 'a', text: 'one' })
      .addMessage({ username: 'b', text: 'two' })

    expect(conv.getMessages()).toHaveLength(2)
    expect(conv.getMessages()[0]?.text).toBe('one')
    expect(conv.getMessages()[1]?.text).toBe('two')
  })

  it('setMessages replaces rather than appends', () => {
    const conv = new MiQConversation()
      .addMessage({ username: 'a', text: 'one' })
      .setMessages([{ username: 'b', text: 'two' }])

    expect(conv.getMessages()).toHaveLength(1)
    expect(conv.getMessages()[0]?.text).toBe('two')
  })

  it('setFromMessages replaces with content/name/avatar read off each message', () => {
    const conv = new MiQConversation().setFromMessages([v14Message()])

    expect(conv.getMessages()).toEqual([
      {
        text: 'Hello World!',
        username: 'otoneko.',
        displayName: 'ねこ',
        avatar: 'https://cdn.discordapp.com/avatars/1/member.png?size=512',
      },
    ])
  })

  it('setFromMessages passes options through, same as MiQ#setFromMessage', () => {
    const conv = new MiQConversation().setFromMessages([v14Message()], { avatar: 'global' })

    expect(conv.getMessages()[0]?.avatar).toContain('user')
  })

  it('getMessages hands back a copy', () => {
    const conv = new MiQConversation().addMessage({ username: 'a', text: 'one' })
    const messages = conv.getMessages()
    messages[0].text = 'tampered'

    expect(conv.getMessages()[0]?.text).toBe('one')
  })

  it('clone does not share messages with the original', () => {
    const original = new MiQConversation().addMessage({ username: 'a', text: 'one' })
    const copy = original.clone().addMessage({ username: 'b', text: 'two' })

    expect(original.getMessages()).toHaveLength(1)
    expect(copy.getMessages()).toHaveLength(2)
  })
})

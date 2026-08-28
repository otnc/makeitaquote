import { describe, expect, it } from 'vitest'
import { discordEmojiURL, misskeyEmojiURL, segmentText } from './segment'

/** Real ids, from assets/discordemoji.json. */
const CHU = '<:chu_:1485918581815377950>'
const HINA = '<:hina:1532748542370643999>'

/** Real instance and shortcodes, from assets/misskeycustomemoji.json. */
const MISSKEY_INSTANCE = 'https://misskey.otnc.dev/'

function kinds(text: string, options?: Parameters<typeof segmentText>[1]): string[] {
  return segmentText(text, options).map((s) => s.kind)
}

function raws(text: string, options?: Parameters<typeof segmentText>[1]): string[] {
  return segmentText(text, options).map((s) => (s.kind === 'text' ? s.value : s.raw))
}

describe('segmentText', () => {
  it('returns a single run for plain text', () => {
    expect(segmentText('Hello World!')).toEqual([{ kind: 'text', value: 'Hello World!' }])
  })

  it('returns nothing for an empty string', () => {
    expect(segmentText('')).toEqual([])
  })

  it('splits standard emoji out of the surrounding text', () => {
    expect(raws('君👼の味方🤝だよ')).toEqual(['君', '👼', 'の味方', '🤝', 'だよ'])
  })

  it('keeps a ZWJ sequence as one emoji', () => {
    const segments = segmentText('家族👨‍👩‍👧‍👦です')

    expect(segments).toHaveLength(3)
    expect(segments[1]).toMatchObject({ kind: 'emoji', raw: '👨‍👩‍👧‍👦' })
  })

  it('keeps a skin-tone modifier attached to its base emoji', () => {
    const segments = segmentText('👍🏽')

    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ kind: 'emoji', raw: '👍🏽' })
  })
})

describe('Discord custom emoji', () => {
  it('recognises a real shortcode', () => {
    const segments = segmentText(`nice ${CHU} one`)

    expect(segments[1]).toEqual({
      kind: 'emoji',
      source: 'discord',
      url: 'https://cdn.discordapp.com/emojis/1485918581815377950.png?size=64',
      raw: CHU,
      id: '1485918581815377950',
      name: 'chu_',
      animated: false,
    })
  })

  it('handles several in one string', () => {
    expect(kinds(`${CHU} と ${HINA}`)).toEqual(['emoji', 'text', 'emoji'])
  })

  it('requests a GIF for animated emoji', () => {
    const segments = segmentText('<a:spin:123456789012345678>')

    expect(segments[0]).toMatchObject({
      animated: true,
      url: 'https://cdn.discordapp.com/emojis/123456789012345678.gif?size=64',
    })
  })

  it('mixes with standard emoji', () => {
    expect(kinds(`a👼b${HINA}d`)).toEqual(['text', 'emoji', 'text', 'emoji', 'text'])
  })

  it('leaves text that only looks like the syntax alone', () => {
    const notEmoji = [
      '<:cat:1>', // id too short to be a snowflake
      '<:toolongofanamethatkeepsgoingandgoingandgoing:123456789012345678>',
      '<::123456789012345678>',
    ]

    for (const text of notEmoji) {
      expect(segmentText(text)).toEqual([{ kind: 'text', value: text }])
    }
  })

  it('recognises a single-character name', () => {
    const segments = segmentText('<:e:1263720914583949393>')

    expect(segments).toEqual([
      {
        kind: 'emoji',
        source: 'discord',
        url: 'https://cdn.discordapp.com/emojis/1263720914583949393.png?size=64',
        raw: '<:e:1263720914583949393>',
        id: '1263720914583949393',
        name: 'e',
        animated: false,
      },
    ])
  })

  it('honours the requested CDN size', () => {
    expect(segmentText(CHU, { emojiSize: 128 })[0]).toMatchObject({
      url: expect.stringContaining('size=128'),
    })
  })
})

describe('Misskey custom emoji', () => {
  const misskey = { misskey: MISSKEY_INSTANCE }

  it('leaves a bare shortcode as text when no instance is known', () => {
    // Nothing to resolve it against, so it is drawn exactly as written.
    expect(segmentText(':alice_i:')).toEqual([{ kind: 'text', value: ':alice_i:' }])
  })

  it('resolves a federated shortcode with no configuration at all', () => {
    // The host is in the shortcode, so this needs no instance.
    expect(segmentText(':blobcat@example.social:')[0]).toMatchObject({
      source: 'misskey',
      host: 'example.social',
    })
  })

  it('resolves a bare shortcode against the configured instance', () => {
    const segments = segmentText(':alice_i:', misskey)

    expect(segments[0]).toEqual({
      kind: 'emoji',
      source: 'misskey',
      url: 'https://misskey.otnc.dev/emoji/alice_i.webp',
      raw: ':alice_i:',
      name: 'alice_i',
      host: 'misskey.otnc.dev',
    })
  })

  it('accepts a bare hostname as the instance', () => {
    const segments = segmentText(':chise_hoe:', { misskey: 'misskey.otnc.dev' })

    expect(segments[0]).toMatchObject({ url: 'https://misskey.otnc.dev/emoji/chise_hoe.webp' })
  })

  it('keeps the text around it', () => {
    expect(raws('わーい :alice_i: たのしい', misskey)).toEqual([
      'わーい ',
      ':alice_i:',
      ' たのしい',
    ])
  })

  it('handles two in a row', () => {
    expect(kinds(':alice_i::chise_hoe:', misskey)).toEqual(['emoji', 'emoji'])
  })

  it('resolves a remote shortcode against its own host', () => {
    const segments = segmentText(':blobcat@example.social:', misskey)

    expect(segments[0]).toMatchObject({
      host: 'example.social',
      url: 'https://example.social/emoji/blobcat.webp',
    })
  })

  it('treats @. as the local instance', () => {
    expect(segmentText(':alice_i@.:', misskey)[0]).toMatchObject({ host: 'misskey.otnc.dev' })
  })

  it('can resolve remote shortcodes with no local instance set', () => {
    const segments = segmentText(':blobcat@example.social:', { misskey: {} })

    expect(segments[0]).toMatchObject({ source: 'misskey', host: 'example.social' })
  })

  it('leaves a bare shortcode alone when no instance is set', () => {
    expect(segmentText(':alice_i:', { misskey: {} })).toEqual([
      { kind: 'text', value: ':alice_i:' },
    ])
  })

  it('ignores remote shortcodes when remote is off', () => {
    const segments = segmentText(':blobcat@example.social:', {
      misskey: { instance: 'misskey.otnc.dev', remote: false },
    })

    expect(segments.every((s) => s.kind === 'text')).toBe(true)
  })

  describe('text that only looks like a shortcode', () => {
    const leftAlone = [
      '会議は 12:30:45 からです', // the inner :30: follows a digit
      '00:00:00',
      '1:23:45',
      '23:59:59 に終わる',
      'https://example.com/a:b:c',
      'key:value:other',
      'ratio 3:4:5',
      ':a:', // name shorter than two characters
      ':not an emoji:', // whitespace in the name
      ':2024:', // purely numeric name
      'ID: :12345: です', // same, even with a space before it
    ]

    for (const text of leftAlone) {
      it(`leaves ${JSON.stringify(text)} alone`, () => {
        expect(segmentText(text, misskey)).toEqual([{ kind: 'text', value: text }])
      })
    }
  })

  it('still matches after a non-ASCII character', () => {
    // The rule is about ASCII alphanumerics, so Japanese text before a
    // shortcode must not block it.
    expect(segmentText('たのしい:alice_i:', misskey)[1]).toMatchObject({ source: 'misskey' })
  })

  it('still matches after punctuation', () => {
    expect(segmentText('(:alice_i:)', misskey)[1]).toMatchObject({ source: 'misskey' })
  })

  it('draws an unresolvable shortcode as its own text, mid-sentence', () => {
    // No instance configured, so `:alice_i:` cannot resolve — but the rest of
    // the line still segments normally.
    expect(raws('わーい :alice_i: 👼')).toEqual(['わーい :alice_i: ', '👼'])
  })

  it('does not match a single-character name', () => {
    expect(segmentText(':a:', misskey)).toEqual([{ kind: 'text', value: ':a:' }])
  })

  it('does not match across whitespace', () => {
    expect(segmentText(':not an emoji:', misskey)).toEqual([
      { kind: 'text', value: ':not an emoji:' },
    ])
  })

  it('coexists with Discord and standard emoji', () => {
    expect(kinds(`👼 ${HINA} :alice_i:`, misskey)).toEqual([
      'emoji',
      'text',
      'emoji',
      'text',
      'emoji',
    ])
  })

  it('percent-encodes an awkward name', () => {
    expect(misskeyEmojiURL('example.social', 'a+b')).toBe('https://example.social/emoji/a%2Bb.webp')
  })

  describe('several instances', () => {
    const both = { misskey: ['https://one.example', 'https://two.example'] }

    it('resolves a bare shortcode against the first', () => {
      expect(segmentText(':blobcat:', both)[0]).toMatchObject({
        host: 'one.example',
        url: 'https://one.example/emoji/blobcat.webp',
      })
    })

    it('offers the rest as alternatives for the loader to try', () => {
      expect(segmentText(':blobcat:', both)[0]).toMatchObject({
        alternativeUrls: ['https://two.example/emoji/blobcat.webp'],
      })
    })

    it('accepts them through the options object too', () => {
      const segments = segmentText(':blobcat:', {
        misskey: { instance: ['https://one.example', 'https://two.example'] },
      })

      expect(segments[0]).toMatchObject({ host: 'one.example' })
    })

    it('offers no alternatives for a federated shortcode', () => {
      // The host is explicit, so there is nothing to guess at.
      expect(segmentText(':blobcat@three.example:', both)[0]).not.toHaveProperty('alternativeUrls')
    })

    it('offers no alternatives when only one instance is configured', () => {
      expect(segmentText(':blobcat:', { misskey: 'https://one.example' })[0]).not.toHaveProperty(
        'alternativeUrls',
      )
    })

    it('drops duplicates and unreadable entries', () => {
      const segments = segmentText(':blobcat:', {
        misskey: ['https://one.example', 'one.example', '   '],
      })

      expect(segments[0]).not.toHaveProperty('alternativeUrls')
    })
  })

  it('ignores an unparseable instance', () => {
    expect(segmentText(':alice_i:', { misskey: '   ' })).toEqual([
      { kind: 'text', value: ':alice_i:' },
    ])
  })
})

describe('discordEmojiURL', () => {
  it('builds a PNG url by default', () => {
    expect(discordEmojiURL('1', false)).toBe('https://cdn.discordapp.com/emojis/1.png?size=64')
  })
})

import { describe, expect, it } from 'vitest'
import { parseTwitterText } from './twitterText'

describe('parseTwitterText', () => {
  it('leaves plain text alone', () => {
    expect(parseTwitterText('nothing to decode here')).toEqual([
      { value: 'nothing to decode here' },
    ])
  })

  it('decodes sans-serif bold letters and digits back to ASCII, styled bold', () => {
    // 𝗕𝗼𝗹𝗱 𝟭𝟮𝟯 — the space between them is an ordinary ASCII space, not a math symbol, so it comes back as its own unstyled run.
    expect(parseTwitterText('𝗕𝗼𝗹𝗱 𝟭𝟮𝟯')).toEqual([
      { value: 'Bold', style: { bold: true } },
      { value: ' ' },
      { value: '123', style: { bold: true } },
    ])
  })

  it('decodes sans-serif italic letters back to ASCII, styled italic', () => {
    // 𝘐𝘵𝘢𝘭𝘪𝘤
    expect(parseTwitterText('𝘐𝘵𝘢𝘭𝘪𝘤')).toEqual([{ value: 'Italic', style: { italic: true } }])
  })

  it('decodes sans-serif bold italic letters back to ASCII, styled both', () => {
    // 𝙗𝙤𝙡𝙙 𝙞𝙩𝙖𝙡𝙞𝙘
    expect(parseTwitterText('𝙗𝙤𝙡𝙙 𝙞𝙩𝙖𝙡𝙞𝙘')).toEqual([
      { value: 'bold', style: { bold: true, italic: true } },
      { value: ' ' },
      { value: 'italic', style: { bold: true, italic: true } },
    ])
  })

  it('decodes serif bold letters and digits back to ASCII, styled bold', () => {
    // 𝐁𝐨𝐥𝐝 𝟏𝟐𝟑
    expect(parseTwitterText('𝐁𝐨𝐥𝐝 𝟏𝟐𝟑')).toEqual([
      { value: 'Bold', style: { bold: true } },
      { value: ' ' },
      { value: '123', style: { bold: true } },
    ])
  })

  it('decodes serif italic letters back to ASCII, styled italic', () => {
    // 𝐼𝑡𝑎𝑙𝑖𝑐
    expect(parseTwitterText('𝐼𝑡𝑎𝑙𝑖𝑐')).toEqual([{ value: 'Italic', style: { italic: true } }])
  })

  it('decodes the legacy italic-h compatibility character', () => {
    // 𝑎𝑙𝑝ℎ𝑎 — italic "alpha" whose "h" comes from the Planck-constant carry-over
    expect(parseTwitterText('𝑎𝑙𝑝ℎ𝑎')).toEqual([{ value: 'alpha', style: { italic: true } }])
  })

  it('leaves an italic number as plain ASCII — Unicode has no italic digits', () => {
    // 𝘐𝘵𝘢𝘭𝘪𝘤 123
    expect(parseTwitterText('𝘐𝘵𝘢𝘭𝘪𝘤 123')).toEqual([
      { value: 'Italic', style: { italic: true } },
      { value: ' 123' },
    ])
  })

  it('mixes styled and plain text in one string', () => {
    // this is 𝗯𝗼𝗹𝗱 but this is not
    expect(parseTwitterText('this is 𝗯𝗼𝗹𝗱 but this is not')).toEqual([
      { value: 'this is ' },
      { value: 'bold', style: { bold: true } },
      { value: ' but this is not' },
    ])
  })

  it('leaves plain (unstyled) sans-serif and monospace characters alone', () => {
    // plain math sans-serif 𝖠 and monospace 𝙰 are not a bold/italic convention
    expect(parseTwitterText('𝖠𝙰')).toEqual([{ value: '𝖠𝙰' }])
  })
})

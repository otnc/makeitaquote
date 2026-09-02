import { required, who } from '../fixtures.js'
import { MiQ } from '../library.js'

export const group = '14-misskey'

const sampleNote = {
  text: '$[jelly おはよう] **今日** はいい天気',
  user: { username: 'otoneko', name: who.displayName, host: null, avatarUrl: required.png },
}

export const cases = [
  {
    name: 'a note, MFM stripped (default)',
    build: () => new MiQ().setFromNote(sampleNote),
    note: 'the display name goes over the @handle, exactly as Misskey writes it',
  },
  {
    name: 'stripMfm: false',
    build: () => new MiQ().setFromNote(sampleNote, { stripMfm: false }),
  },
  {
    name: 'a remote author, quoted from a note',
    build: () =>
      new MiQ().setFromNote({
        text: 'リモートのノートも同じように引用できます',
        user: { username: 'someone', name: null, host: 'misskey.example', avatarUrl: null },
      }),
    note: '@user@host, and the username stands in when there is no display name',
  },
]

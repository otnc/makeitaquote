// --- 14-misskey: notes, and MFM ---------------------------------------------

export default function registerMisskey(add, { MiQ, who, required }) {
  add(
    '14-misskey',
    'a note, MFM stripped (default)',
    () =>
      new MiQ().setFromNote({
        text: '$[jelly おはよう] **今日** はいい天気',
        user: { username: 'otoneko', name: who.displayName, host: null, avatarUrl: required.png },
      }),
    { note: 'the display name goes over the @handle, exactly as Misskey writes it' },
  )
  add('14-misskey', 'stripMfm: false', () =>
    new MiQ().setFromNote(
      {
        text: '$[jelly おはよう] **今日** はいい天気',
        user: { username: 'otoneko', name: who.displayName, host: null, avatarUrl: required.png },
      },
      { stripMfm: false },
    ),
  )
  add(
    '14-misskey',
    'a remote author, quoted from a note',
    () =>
      new MiQ().setFromNote({
        text: 'リモートのノートも同じように引用できます',
        user: { username: 'someone', name: null, host: 'misskey.example', avatarUrl: null },
      }),
    { note: '@user@host, and the username stands in when there is no display name' },
  )
}

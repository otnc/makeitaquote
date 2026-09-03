import { avatars, discordEmoji, misskeyEmoji, required } from './assets.js'
import { MiQ } from './library.js'

export { avatars, discordEmoji, misskeyEmoji, required }

// This gallery is published, so every sample has to read as something a person might plausibly have said out of context. Public-domain prose (Sōseki's *I Am a Cat*) and neutral statements about the library only — no lorem ipsum, nothing that reads as a real quotation from a real person.
export const text = {
  short: '猫は液体である',
  ja: '吾輩は猫である。名前はまだ無い。',
  jaLong:
    '吾輩は猫である。名前はまだ無い。どこで生れたか頓と見当がつかぬ。' +
    '何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。',
  en: 'A quote is just a picture of some words, and a picture of some words is surprisingly hard to get right.',
  kinsoku: 'そうですね。ええ、まったく。「なるほど」と、彼は言った（たぶん）。',
  newlines: '朝は苦手\n昼は眠い\n夜は元気',
  url: '詳しくは https://github.com/otnc/makeitaquote/blob/main/README.md を読んでください',
  veryLong: `${'吾輩は猫である。名前はまだ無い。'.repeat(40)}`,
  twemoji: 'できた👼 うれしい🎉 家族👨‍👩‍👧‍👦 と👍🏽',
  discord: `おはよう ${discordEmoji.join(' ')} いい天気`,
  misskey: `おつかれさま ${misskeyEmoji.emoji.join(' ')} また明日`,
  allEmoji: `👼 ${discordEmoji[0]} ${misskeyEmoji.emoji[0]} 全部いける`,
  mixedScript: 'Vina Sans と日本語が同じ行に並ぶ mixed 123',
  wrapping: '長い文章でも文節の切れ目で折り返すので、読みやすい行が並びます。',
}

export const who = { username: 'otoneko.', displayName: '音猫｡', watermark: 'Make it a Quote' }

/** A builder pre-filled with the usual attribution. */
export function base(options) {
  return new MiQ(options)
    .setUsername(who.username)
    .setDisplayName(who.displayName)
    .setWatermark(who.watermark)
}

/** The same, with Misskey emoji switched on for the demo instance. */
export function misskeyBase() {
  return base({ misskey: misskeyEmoji.instance })
}

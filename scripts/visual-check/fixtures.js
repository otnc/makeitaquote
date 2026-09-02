/**
 * Sample text.
 *
 * This gallery is published, so every line has to read as something a person
 * might plausibly have said — a caption someone lands on out of context should
 * make sense on its own and say nothing about anybody. Public-domain prose
 * (Sōseki's *I Am a Cat*) and neutral statements about the library, no lorem
 * ipsum, no filler, and nothing that could be read as a real quotation from a
 * real person.
 */
function buildText({ discordEmoji, misskeyEmoji }) {
  return {
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
}

/** Sample text, plus the pre-filled `MiQ` builders every case starts from. */
export function buildFixtures({ MiQ, discordEmoji, misskeyEmoji }) {
  const text = buildText({ discordEmoji, misskeyEmoji })
  const who = { username: 'otoneko.', displayName: '音猫｡', watermark: 'Make it a Quote' }

  /** A builder pre-filled with the usual attribution. */
  function base(options) {
    return new MiQ(options)
      .setUsername(who.username)
      .setDisplayName(who.displayName)
      .setWatermark(who.watermark)
  }

  /** The same, with Misskey emoji switched on for the demo instance. */
  function misskeyBase() {
    return base({ misskey: misskeyEmoji.instance })
  }

  return { text, who, base, misskeyBase }
}

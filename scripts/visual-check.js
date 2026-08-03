#!/usr/bin/env node
// Renders a curated set of option combinations and builds a contact sheet, so
// the visible behaviour of the library can be eyeballed in one page.
//
//   npm run build          # visual-check reads dist/, so build first
//   npm run visual         # writes docs/visual/ and its manifest
//   npm run visual -- --offline           # skip anything needing the network
//   npm run visual -- --only theme,emoji  # only matching groups
//
// Cases are grouped into folders, and each group holds only the cases that
// actually look different from one another — variations that render almost
// identically are covered by the unit tests instead.
//
// Every case is also checked programmatically: it has to produce a decodable
// image of the expected format and size. Failures are listed in the console and
// highlighted in the page, so this doubles as a smoke test over the public API.
//
// No dependencies — Node >= 22 built-ins plus the built package.

import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const assetsDir = join(root, 'assets')

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)

function flag(name) {
  return args.includes(`--${name}`)
}

function option(name, fallback) {
  const index = args.indexOf(`--${name}`)
  if (index >= 0 && args[index + 1]) return args[index + 1]
  const inline = args.find((arg) => arg.startsWith(`--${name}=`))
  return inline ? inline.slice(name.length + 3) : fallback
}

const offline = flag('offline')
const outDir = join(root, option('out', 'docs/visual'))
const only = option('only', '')
  .split(',')
  .map((part) => part.trim().toLowerCase())
  .filter(Boolean)

// ---------------------------------------------------------------------------
// Load the built package
// ---------------------------------------------------------------------------

const distEntry = join(root, 'dist', 'index.mjs')
if (!existsSync(distEntry)) {
  console.error('visual-check: dist/index.mjs not found. Run `npm run build` first.')
  process.exit(1)
}

const { MiQ, MiQConversation, FONT_CATALOGUE } = await import(pathToFileURL(distEntry).href)

const packageVersion = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

const required = {
  png: join(assetsDir, 'demo.png'),
  jpg: join(assetsDir, 'demo.jpg'),
  urls: join(assetsDir, 'imageurllist.json'),
  discord: join(assetsDir, 'discordemoji.json'),
  misskey: join(assetsDir, 'misskeycustomemoji.json'),
}

for (const [name, path] of Object.entries(required)) {
  if (!existsSync(path)) {
    console.error(`visual-check: missing asset for "${name}": ${path}`)
    process.exit(1)
  }
}

const imageUrls = JSON.parse(await readFile(required.urls, 'utf8'))
const discordEmoji = JSON.parse(await readFile(required.discord, 'utf8'))
const misskeyEmoji = JSON.parse(await readFile(required.misskey, 'utf8'))
const pngBuffer = await readFile(required.png)

const avatars = {
  illustration: required.png,
  photo: required.jpg,
  buffer: pngBuffer,
  url: imageUrls[0],
  none: null,
  broken: 'https://invalid.invalid/definitely-not-there.png',
}

// ---------------------------------------------------------------------------
// Sample text
// ---------------------------------------------------------------------------

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
const text = {
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

const who = {
  username: 'otoneko.',
  displayName: '音猫｡',
  watermark: 'Make it a Quote',
}

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

// ---------------------------------------------------------------------------
// Cases
//
// Each group is a folder in the output. Keep them short: a case earns its place
// only if it looks meaningfully different from the others in its group.
// ---------------------------------------------------------------------------

const cases = []

function add(group, name, build, extra = {}) {
  cases.push({ group, name, build, ...extra })
}

// --- 01-themes: the five presets, side by side ----------------------------

add('01-themes', 'dark (default)', () =>
  base().setText(text.jaLong).setAvatar(avatars.illustration),
)
add('01-themes', 'light', () =>
  base().setText(text.jaLong).setAvatar(avatars.illustration).setTheme('light'),
)
add('01-themes', 'color (avatar keeps its color)', () =>
  base().setText(text.jaLong).setAvatar(avatars.illustration).setTheme('color'),
)
add('01-themes', 'portrait', () =>
  base().setText(text.short).setAvatar(avatars.illustration).setTheme('portrait'),
)
add('01-themes', 'portrait-light', () =>
  base().setText(text.short).setAvatar(avatars.illustration).setTheme('portrait-light'),
)

// --- 02-layout: arrangement, not styling ----------------------------------

add('02-layout', 'avatar left (default)', () =>
  base().setText(text.jaLong).setAvatar(avatars.illustration),
)
add(
  '02-layout',
  'avatar right — text, gradient and watermark all follow',
  () =>
    base()
      .setText(text.jaLong)
      .setAvatar(avatars.illustration)
      .setTheme({ avatar: { position: 'right' } }),
  { note: "text.area and watermark.position are 'auto' by default" },
)
add('02-layout', 'narrow avatar', () =>
  base()
    .setText(text.jaLong)
    .setAvatar(avatars.illustration)
    .setTheme({
      avatar: { widthRatio: 0.32 },
      gradient: { startRatio: 0.14, endRatio: 0.32 },
    }),
)
add('02-layout', 'stacked on a landscape canvas', () =>
  base()
    .setText(text.short)
    .setAvatar(avatars.photo)
    .setTheme({ extends: 'portrait', width: 1280, height: 720 }),
)
add('02-layout', 'no gradient', () =>
  base()
    .setText(text.ja)
    .setAvatar(avatars.illustration)
    .setTheme({ gradient: { enabled: false } }),
)
add(
  '02-layout',
  'circular avatar',
  () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.illustration)
      .setTheme({ avatar: { shape: 'circle', widthRatio: 0.32 }, gradient: { enabled: false } }),
  { note: 'clipped to the largest circle that fits the box; the fallback tile matches' },
)

// --- 03-text: wrapping and fitting ----------------------------------------

add('03-text', 'short', () => base().setText(text.short).setAvatar(avatars.illustration))
add('03-text', 'long — wraps and shrinks', () =>
  base().setText(text.jaLong).setAvatar(avatars.illustration),
)
add('03-text', 'english wraps at spaces', () =>
  base().setText(text.en).setAvatar(avatars.illustration),
)
add('03-text', 'kinsoku — no stranded punctuation', () =>
  base().setText(text.kinsoku).setAvatar(avatars.illustration),
)
add(
  '03-text',
  'phraseBreak off — breaks per character',
  () =>
    base()
      .setText(text.jaLong)
      .setAvatar(avatars.illustration)
      .setTheme({ text: { phraseBreak: false } }),
  { note: 'compare with "long — wraps and shrinks"' },
)
add('03-text', 'explicit newlines', () =>
  base().setText(text.newlines).setAvatar(avatars.illustration),
)
add('03-text', 'long url is force-broken', () =>
  base().setText(text.url).setAvatar(avatars.illustration),
)
add('03-text', 'overflow: ellipsis (default)', () =>
  base().setText(text.veryLong).setAvatar(avatars.illustration),
)
add('03-text', 'overflow: shrink', () =>
  base()
    .setText(text.veryLong)
    .setAvatar(avatars.illustration)
    .setTheme({ text: { overflow: 'shrink' } }),
)
add('03-text', 'left aligned', () =>
  base()
    .setText(text.jaLong)
    .setAvatar(avatars.illustration)
    .setTheme({ text: { align: 'left' } }),
)

// --- 04-emoji: the three sources ------------------------------------------

add(
  '04-emoji',
  'twemoji, including ZWJ and skin tone',
  () => base().setText(text.twemoji).setAvatar(avatars.illustration),
  { network: true },
)
add(
  '04-emoji',
  'discord custom emoji',
  () => base().setText(text.discord).setAvatar(avatars.illustration),
  { network: true, note: 'real ids from assets/discordemoji.json' },
)
add(
  '04-emoji',
  'misskey custom emoji',
  () => misskeyBase().setText(text.misskey).setAvatar(avatars.illustration),
  { network: true, note: `instance: ${misskeyEmoji.instance}` },
)
add(
  '04-emoji',
  'all three together',
  () => misskeyBase().setText(text.allEmoji).setAvatar(avatars.illustration),
  { network: true },
)
add(
  '04-emoji',
  'misskey off — drawn as plain text',
  () => base().setText(text.misskey).setAvatar(avatars.illustration),
  { note: 'Misskey emoji only resolve when an instance is configured' },
)
add(
  '04-emoji',
  'unfetchable emoji falls back to its source text',
  () => base().setText('これ <:nope:123456789012345678> です').setAvatar(avatars.illustration),
  { network: true },
)

// --- 05-typography: weight ------------------------------------------------

add('05-typography', 'normal (default)', () =>
  base().setText(text.wrapping).setAvatar(avatars.illustration),
)
add(
  '05-typography',
  'bold',
  () =>
    base()
      .setText(text.wrapping)
      .setAvatar(avatars.illustration)
      .setTheme({ text: { weight: 'bold' } }),
  { note: 'emulated by stroking when the font has no bold face' },
)
add('05-typography', 'weight 900', () =>
  base()
    .setText(text.wrapping)
    .setAvatar(avatars.illustration)
    .setTheme({ text: { weight: 900 } }),
)
add('05-typography', 'everything bold', () =>
  base()
    .setText(text.ja)
    .setAvatar(avatars.illustration)
    .setTheme({
      text: { weight: 'bold' },
      displayName: { weight: 'bold' },
      username: { weight: 'bold' },
      watermark: { weight: 'bold' },
    }),
)

// --- 06-fonts: catalogue families -----------------------------------------

for (const family of FONT_CATALOGUE) {
  add(
    '06-fonts',
    family,
    () =>
      base()
        .setText(`${family}\n映える引用 Quote 123`)
        .setAvatar(avatars.illustration)
        .setTheme({ text: { font: `${family}, Noto Sans JP, sans-serif` } }),
    { network: true },
  )
}

// --- 07-quotes: quote marks and divider -----------------------------------

add('07-quotes', 'none (default)', () => base().setText(text.ja).setAvatar(avatars.illustration))
add('07-quotes', 'inline', () =>
  base()
    .setText(text.ja)
    .setAvatar(avatars.illustration)
    .setTheme({ quoteMark: { display: 'inline' } }),
)
add('07-quotes', 'inline with 「」', () =>
  base()
    .setText(text.ja)
    .setAvatar(avatars.illustration)
    .setTheme({ quoteMark: { display: 'inline', chars: ['「', '」'] } }),
)
add('07-quotes', 'block', () =>
  base()
    .setText(text.ja)
    .setAvatar(avatars.illustration)
    .setTheme({ quoteMark: { display: 'block' } }),
)
add('07-quotes', 'divider', () =>
  base()
    .setText(text.ja)
    .setAvatar(avatars.illustration)
    .setTheme({ divider: { enabled: true } }),
)

// --- 08-avatar: sources and fallbacks -------------------------------------

add('08-avatar', 'illustration (png with alpha)', () =>
  base().setText(text.ja).setAvatar(avatars.illustration),
)
add('08-avatar', 'photo (jpg)', () => base().setText(text.ja).setAvatar(avatars.photo))
add('08-avatar', 'color kept', () =>
  base()
    .setText(text.ja)
    .setAvatar(avatars.photo)
    .setTheme({ avatar: { grayscale: false } }),
)
add('08-avatar', 'from a remote url', () => base().setText(text.ja).setAvatar(avatars.url), {
  network: true,
})
add('08-avatar', 'from a Buffer', () => base().setText(text.ja).setAvatar(avatars.buffer))
add('08-avatar', 'none — fallback tile with initial', () =>
  base().setText(text.ja).setAvatar(avatars.none),
)
add('08-avatar', 'unreachable url — same fallback', () =>
  base().setText(text.ja).setAvatar(avatars.broken),
)
add('08-avatar', 'no fallback tile at all', () =>
  base()
    .setText(text.ja)
    .setAvatar(avatars.none)
    .setTheme({ avatar: { fallback: null } }),
)

// --- 10-formats -----------------------------------------------------------

add('10-formats', 'png', () => base().setText(text.ja).setAvatar(avatars.illustration), {
  format: 'png',
})
add(
  '10-formats',
  'jpeg q40 (visibly lossy)',
  () => base().setText(text.ja).setAvatar(avatars.illustration),
  { format: 'jpeg', encodeOptions: { quality: 40 } },
)
add('10-formats', 'webp q90', () => base().setText(text.ja).setAvatar(avatars.illustration), {
  format: 'webp',
  encodeOptions: { quality: 90 },
})
add('10-formats', 'avif q60', () => base().setText(text.ja).setAvatar(avatars.illustration), {
  format: 'avif',
  encodeOptions: { quality: 60 },
})

// --- 11-discord: what a bot actually produces -----------------------------

add(
  '11-discord',
  'from a discord.js v14 message',
  () =>
    new MiQ().setFromMessage({
      content: `おはよう ${discordEmoji[0]}`,
      author: {
        username: 'otoneko.',
        globalName: '音猫｡',
        discriminator: '0',
        displayAvatarURL: () => avatars.url,
      },
      member: { displayName: 'ねこ', displayAvatarURL: () => avatars.url },
    }),
  { network: true },
)
add(
  '11-discord',
  'from a legacy message (discriminator kept)',
  () =>
    new MiQ().setFromMessage({
      content: text.ja,
      author: { username: 'otoneko', discriminator: '6666', displayAvatarURL: () => avatars.url },
      member: null,
    }),
  { network: true },
)
add('11-discord', 'from a minimal message (no avatar)', () =>
  new MiQ().setFromMessage({ content: text.ja, author: { username: 'someone' } }),
)
add(
  '11-discord',
  'markdown quoted as written (default)',
  () =>
    new MiQ().setFromMessage({
      content: '**このパッケージ**は自分で*太字*を解除しません',
      author: { username: 'someone' },
    }),
  { note: 'stripMarkdown defaults to false — compare with the next card' },
)
add('11-discord', 'stripMarkdown: true', () =>
  new MiQ().setFromMessage(
    { content: '**このパッケージ**は自分で*太字*を解除しません', author: { username: 'someone' } },
    { stripMarkdown: true },
  ),
)
add(
  '11-discord',
  'mentions resolved (default)',
  () =>
    new MiQ().setFromMessage({
      content: 'いってらっしゃい <@1>、今日は <#2> で <@&3> の集まりです',
      author: { username: 'someone' },
      mentions: {
        users: new Map([['1', { username: 'otoneko' }]]),
        channels: new Map([['2', { name: '雑談' }]]),
        roles: new Map([['3', { name: 'メンバー' }]]),
      },
    }),
  { note: 'resolveMentions defaults to true — compare with the next card' },
)
add('11-discord', 'resolveMentions: false', () =>
  new MiQ().setFromMessage(
    {
      content: 'いってらっしゃい <@1>、今日は <#2> で <@&3> の集まりです',
      author: { username: 'someone' },
      mentions: {
        users: new Map([['1', { username: 'otoneko' }]]),
        channels: new Map([['2', { name: '雑談' }]]),
        roles: new Map([['3', { name: 'メンバー' }]]),
      },
    },
    { resolveMentions: false },
  ),
)

add(
  '11-discord',
  'slash commands, timestamps and navigation tabs',
  () =>
    new MiQ().setFromMessage({
      content: '</remind set:1> で <t:1618935630:F> に、詳しくは <id:guide> を見てね',
      author: { username: 'someone' },
    }),
  { note: 'these carry everything they need in the token — no lookup involved' },
)

// --- 14-misskey: notes, and MFM -------------------------------------------

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

// --- 12-colors: the color system ----------------------------------------

add(
  '12-colors',
  'tokyo night',
  () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.illustration)
      .setTheme({
        extends: 'custom',
        background: '#1A1B26',
        text: { color: '#C0CAF5' },
        displayName: { color: '#7AA2F7' },
        username: { color: '#565F89' },
        watermark: { color: '#414868' },
      }),
  { note: 'custom starts fully transparent; every color here is set explicitly' },
)
add(
  '12-colors',
  'nord',
  () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.illustration)
      .setTheme({
        extends: 'custom',
        background: 0x2e3440,
        text: { color: 0xeceff4 },
        displayName: { color: 0x88c0d0 },
        username: { color: 0x4c566a },
        watermark: { color: 0x434c5e },
      }),
  { note: 'the same thing written as 0xRRGGBB numbers' },
)
add(
  '12-colors',
  'CSS colour names and hsl()',
  () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.illustration)
      .setTheme({
        extends: 'custom',
        background: 'midnightblue',
        text: { color: 'lavender' },
        displayName: { color: 'hsl(45, 100%, 70%)' },
        username: { color: 'slategray' },
      }),
  { note: 'strings go through the color package, so all of CSS is available' },
)
add('12-colors', 'solarized, as rgba arrays', () =>
  base()
    .setText(text.ja)
    .setAvatar(avatars.illustration)
    .setTheme({
      extends: 'custom',
      background: [0, 43, 54, 1],
      text: { color: [253, 246, 227, 1] },
      displayName: { color: [42, 161, 152, 1] },
      username: { color: [88, 110, 117, 1] },
      watermark: { color: [7, 54, 66, 1] },
    }),
)
add(
  '12-colors',
  'translucent background over the avatar',
  () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.illustration)
      .setTheme({
        extends: 'custom',
        layout: 'stacked',
        background: '#000000A0',
        gradient: { enabled: false },
        text: { color: '#FFFFFF' },
        displayName: { color: '#FFFFFF' },
        username: { color: '#CCCCCC' },
        watermark: { color: '#888888' },
      }),
  { note: '#RRGGBBAA — the avatar shows through the wash' },
)
add(
  '12-colors',
  'transparent background (checkerboard is the page)',
  () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.none)
      .setTheme({
        extends: 'custom',
        text: { color: '#FFFFFF' },
        displayName: { color: '#FFFFFF' },
        username: { color: '#AAAAAA' },
      }),
  { note: 'nothing is painted where the background would be' },
)
add(
  '12-colors',
  'background image',
  () =>
    base()
      .setText(text.ja)
      .setAvatar(avatars.none)
      .setTheme({
        extends: 'custom',
        background: '#000000',
        backgroundImage: { source: avatars.photo, fit: 'cover', opacity: 0.5 },
        text: { color: '#FFFFFF' },
        displayName: { color: '#FFFFFF' },
        username: { color: '#CCCCCC' },
      }),
  { note: 'a photo behind the quote, dimmed by backgroundImage.opacity' },
)

// --- 09-sizing: scale and fitting -----------------------------------------

add(
  '09-sizing',
  'default (800 tall)',
  () => base().setText(text.ja).setAvatar(avatars.illustration),
  { expect: { height: 800 } },
)
add(
  '09-sizing',
  'scale 0.5',
  () => base().setText(text.ja).setAvatar(avatars.illustration).setScale(0.5),
  { expect: { height: 400 }, note: 'the same layout at half the resolution' },
)
add(
  '09-sizing',
  'scale 2',
  () => base().setText(text.ja).setAvatar(avatars.illustration).setScale(2),
  { expect: { height: 1600 } },
)
add(
  '09-sizing',
  'sized to the avatar height',
  () => base({ sizeToAvatar: 'height' }).setText(text.ja).setAvatar(avatars.illustration),
  { note: 'the avatar is drawn at its native resolution, never resampled' },
)
add('09-sizing', 'avatar contained rather than cropped', () =>
  base()
    .setText(text.ja)
    .setAvatar(avatars.photo)
    .setTheme({ avatar: { fit: 'contain' } }),
)

// --- 13-conversation: MiQConversation, several messages as one image ------

add(
  '13-conversation',
  'dark (default) — consecutive messages from one speaker group',
  () =>
    new MiQConversation()
      .addMessage({
        username: who.username,
        displayName: who.displayName,
        avatar: avatars.illustration,
        text: text.ja,
      })
      .addMessage({
        username: who.username,
        displayName: who.displayName,
        avatar: avatars.illustration,
        text: 'どこで生れたか頓と見当がつかぬ。',
      })
      .addMessage({ username: 'someone', text: text.en }),
  { note: 'the second message shares an avatar and name with the first' },
)
add('13-conversation', 'light', () =>
  new MiQConversation({ theme: 'light' })
    .addMessage({ username: who.username, avatar: avatars.photo, text: text.short })
    .addMessage({ username: 'someone', text: 'Quoting a whole thread, not just one line.' }),
)
add(
  '13-conversation',
  'from real messages (setFromMessages)',
  () =>
    new MiQConversation().setFromMessages([
      {
        content: `おはよう ${discordEmoji[0]}`,
        author: { username: 'otoneko.', globalName: '音猫｡', displayAvatarURL: () => avatars.url },
      },
      { content: 'いい天気ですね', author: { username: 'otoneko.', globalName: '音猫｡' } },
    ]),
  { network: true, note: 'reads content/name/avatar the same way MiQ#setFromMessage() does' },
)

// ---------------------------------------------------------------------------
// Image sniffing, so a case is verified and not merely produced
// ---------------------------------------------------------------------------

const SIGNATURES = {
  png: (b) =>
    b.length > 24 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  jpeg: (b) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: (b) =>
    b.length > 12 &&
    b.subarray(0, 4).toString('ascii') === 'RIFF' &&
    b.subarray(8, 12).toString('ascii') === 'WEBP',
  avif: (b) => b.length > 12 && b.subarray(4, 8).toString('ascii') === 'ftyp',
}

/** Longest edge of a published image. Enough to judge a render by eye. */
const GALLERY_MAX_EDGE = 900

/**
 * A lighter copy of a render, for committing and serving.
 *
 * The checks above run against the original bytes, so verification keeps full
 * fidelity; only what lands in the repository is reduced. Anything already
 * small enough, and anything whose format is the point of the case, is left
 * exactly as it was.
 */
async function forPublication(buffer, format) {
  if (format !== 'png') return { bytes: buffer, extension: null }

  const image = await loadImage(buffer)
  const scale = GALLERY_MAX_EDGE / Math.max(image.width, image.height)
  if (scale >= 1) return { bytes: buffer, extension: null }

  const canvas = createCanvas(Math.round(image.width * scale), Math.round(image.height * scale))
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  return { bytes: await canvas.encode('webp', 82), extension: 'webp' }
}

/** Width and height straight out of the PNG IHDR chunk. */
function pngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

// Every group that exists, regardless of --only — the index manifest lists
// all of them even when this particular run only touches some.
const allGroups = [...new Set(cases.map((testCase) => testCase.group))]

const selected = cases.filter((testCase) => {
  if (offline && testCase.network) return false
  if (only.length === 0) return true
  return only.some(
    (pattern) =>
      testCase.group.toLowerCase().includes(pattern) ||
      testCase.name.toLowerCase().includes(pattern),
  )
})

if (selected.length === 0) {
  console.error('visual-check: no cases matched')
  process.exit(1)
}

await mkdir(outDir, { recursive: true })

// Only the groups actually being (re)rendered are cleared — `--only` runs
// leave every other group's images and manifest exactly as they were,
// rather than wiping the whole gallery down to one group.
const groupsToRender = [...new Set(selected.map((testCase) => testCase.group))]
for (const group of groupsToRender) {
  await rm(join(outDir, group), { recursive: true, force: true })
  await mkdir(join(outDir, group), { recursive: true })
}

console.log(
  `visual-check: rendering ${selected.length} cases${offline ? ' (offline)' : ''} → ${outDir}`,
)

const results = []
const startedAt = Date.now()
let currentGroup = ''

for (const testCase of selected) {
  const format = testCase.format ?? 'png'
  const slug = testCase.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const file = `${testCase.group}/${slug || 'case'}.${format === 'jpeg' ? 'jpg' : format}`

  if (testCase.group !== currentGroup) {
    currentGroup = testCase.group
    await mkdir(join(outDir, currentGroup), { recursive: true })
    console.log(`\n  ${currentGroup}`)
  }

  const result = { ...testCase, format, file, problems: [] }

  try {
    const miq = testCase.build()
    const buffer = await miq.toBuffer(format, testCase.encodeOptions)

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      result.problems.push('produced no bytes')
    } else if (!SIGNATURES[format](buffer)) {
      result.problems.push(`bytes are not a valid ${format}`)
    }

    if (format === 'png' && buffer.length > 24) {
      const size = pngSize(buffer)
      result.size = size
      const expected = testCase.expect ?? {}
      if (expected.width && size.width !== expected.width) {
        result.problems.push(`width ${size.width}, expected ${expected.width}`)
      }
      if (expected.height && size.height !== expected.height) {
        result.problems.push(`height ${size.height}, expected ${expected.height}`)
      }
    }

    // Everything above is checked against the real render. What gets written
    // is a lighter copy: this gallery is committed and served over Pages, and
    // full-resolution PNGs of 77 cases come to ~19 MB.
    const published = await forPublication(buffer, format)
    if (published.extension) result.file = file.replace(/\.\w+$/, `.${published.extension}`)
    result.bytes = published.bytes.length
    await writeFile(join(outDir, result.file), published.bytes)
  } catch (error) {
    result.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    result.problems.push('threw')
  }

  results.push(result)

  const status = result.problems.length === 0 ? 'ok' : 'FAIL'
  process.stdout.write(
    `    ${status.padEnd(4)} ${testCase.name}${result.error ? ` — ${result.error}` : ''}\n`,
  )
}

// ---------------------------------------------------------------------------
// Manifest
//
// Split one file per group (docs/visual/<group>/manifest.json) plus a small
// index (docs/visual/manifest.json) listing which groups exist. Two PRs
// touching different groups now touch different files, full stop — no shared
// file for them to conflict on. Within a group's own file there is nothing
// but a pure function of its cases: no timestamp, no counts, nothing that
// changes between two runs unless the rendered output actually did.
// ---------------------------------------------------------------------------

const failed = results.filter((result) => result.problems.length > 0)
const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)

for (const group of groupsToRender) {
  const groupManifest = {
    name: group,
    title: titleOf(group),
    cases: results
      .filter((result) => result.group === group)
      .map((result) => ({
        name: result.name,
        file: result.file,
        note: result.note ?? null,
        format: result.format,
        width: result.size?.width ?? null,
        height: result.size?.height ?? null,
        bytes: result.bytes ?? null,
        ok: result.problems.length === 0,
        error: result.error ?? (result.problems.length > 0 ? result.problems.join('; ') : null),
      })),
  }

  await writeFile(
    join(outDir, group, 'manifest.json'),
    `${JSON.stringify(groupManifest, null, 2)}\n`,
  )
}

// The index has to list every group that exists, not just the ones this run
// touched — `allGroups` comes from the full case list, so a partial `--only`
// run never shrinks it. It changes only when a group is added or removed, or
// on a version bump, which is rare enough that it is barely ever the thing
// two branches collide on.
const index = {
  version: packageVersion,
  groups: allGroups.map((group) => ({ name: group, title: titleOf(group) })),
}

await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(index, null, 2)}\n`)

/** Turns `01-themes` into `Themes`, for the gallery headings. */
function titleOf(group) {
  return group
    .replace(/^\d+-/, '')
    .replace(/-/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------

console.log(
  `\nvisual-check: ${results.length - failed.length}/${results.length} ok in ${elapsed}s\n` +
    `  wrote ${join(outDir, 'manifest.json')}\n` +
    `  open  ${join(root, 'docs', 'index.html')}`,
)

if (failed.length > 0) {
  console.error(`\n${failed.length} case(s) failed:`)
  for (const result of failed) {
    console.error(
      `  ✗ ${result.group}/${result.name}: ${result.error ?? result.problems.join('; ')}`,
    )
  }
  process.exit(1)
}

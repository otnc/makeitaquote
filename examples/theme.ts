import { writeFile } from 'node:fs/promises'
import { defineTheme, MiQ } from 'makeitaquote'

const quote = () =>
  new MiQ().setText('今日はとてもいい天気ですね。').setUsername('otoneko.').setDisplayName('音猫｡')

// Presets
await writeFile('dark.png', await quote().toBuffer('png'))
await writeFile('light.png', await quote().setTheme('light').toBuffer('png'))

// Partial overrides merge onto a preset, so only what you name changes.
await writeFile(
  'custom.png',
  await quote()
    .setTheme({
      extends: 'light',
      background: '#FFF8E7',
      text: { color: '#2B2B2B', align: 'left' },
      avatar: { grayscale: false, position: 'right' },
    })
    .setScale(1.25)
    .toBuffer('png'),
)

// Sizes are fractions of the canvas, so a theme keeps its proportions at any
// size. Values above 1 are read as pixels instead.
const bigText = defineTheme({ text: { size: 0.09, minSize: 0.04 } })
console.log(bigText.text.size)

// setScale is a true zoom: the same layout, more pixels. Prefer it over
// setSize, which changes the aspect ratio without moving anything else and is
// deprecated for that reason.
await writeFile('large.png', await quote().setScale(2).toBuffer('png'))

// For a genuinely different shape, say so on the theme.
await writeFile(
  'widescreen.png',
  await quote().setTheme({ width: 1920, height: 816 }).toBuffer('png'),
)

// Turn off the phrase-aware line breaking if you'd rather break per character.
await writeFile(
  'plain-wrap.png',
  await quote()
    .setTheme({ text: { phraseBreak: false } })
    .toBuffer('png'),
)

// The new layout: the avatar fills the canvas and fades downwards, with the
// quote laid over the bottom of it.
await writeFile('new.png', await quote().setTheme({ layout: 'new' }).toBuffer('png'))

// Flip the sides. The quote area, the gradient and the watermark all follow.
await writeFile(
  'flipped.png',
  await quote()
    .setTheme({ avatar: { position: 'right' } })
    .toBuffer('png'),
)

// Bold. Works even with variable fonts that expose no bold face.
await writeFile(
  'bold.png',
  await quote()
    .setTheme({ text: { weight: 'bold' }, displayName: { weight: 600 } })
    .toBuffer('png'),
)

// Keep the avatar in color instead of desaturating it.
await writeFile(
  'color-avatar.png',
  await quote()
    .setTheme({ avatar: { grayscale: false } })
    .toBuffer('png'),
)

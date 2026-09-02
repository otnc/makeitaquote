import * as themes from './01-themes.js'
import * as layout from './02-layout.js'
import * as text from './03-text.js'
import * as emoji from './04-emoji.js'
import * as typography from './05-typography.js'
import * as fonts from './06-fonts.js'
import * as quotes from './07-quotes.js'
import * as avatar from './08-avatar.js'
import * as sizing from './09-sizing.js'
import * as formats from './10-formats.js'
import * as discord from './11-discord.js'
import * as colors from './12-colors.js'
import * as chain from './13-chain.js'
import * as misskey from './14-misskey.js'
import * as markdown from './15-markdown.js'
import * as twitter from './16-twitter.js'
import * as allThemes from './17-all-themes.js'

// This order is the gallery's display order — a curated narrative, not the
// numeric filenames. Add a group by adding a file above and one entry here,
// wherever it reads best.
export const caseModules = [
  themes,
  layout,
  text,
  emoji,
  typography,
  fonts,
  allThemes,
  quotes,
  avatar,
  formats,
  discord,
  misskey,
  twitter,
  markdown,
  colors,
  sizing,
  chain,
]

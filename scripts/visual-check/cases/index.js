import registerThemes from './01-themes.js'
import registerLayout from './02-layout.js'
import registerText from './03-text.js'
import registerEmoji from './04-emoji.js'
import registerTypography from './05-typography.js'
import registerFonts from './06-fonts.js'
import registerQuotes from './07-quotes.js'
import registerAvatar from './08-avatar.js'
import registerSizing from './09-sizing.js'
import registerFormats from './10-formats.js'
import registerDiscord from './11-discord.js'
import registerColors from './12-colors.js'
import registerChain from './13-chain.js'
import registerMisskey from './14-misskey.js'
import registerMarkdown from './15-markdown.js'
import registerTwitter from './16-twitter.js'
import registerAllThemes from './17-all-themes.js'

// Registration order is the gallery's display order — a curated narrative
// (overview → layout → text → emoji → typography → fonts → the exhaustive
// all-themes reference → quotes → avatar → formats → each platform adapter →
// markdown → colors → sizing → chain), not the numeric prefixes. Add a new
// group's file under this directory, then insert its `register*` function
// here wherever it reads best — not necessarily at the end.
export const caseGroups = [
  registerThemes,
  registerLayout,
  registerText,
  registerEmoji,
  registerTypography,
  registerFonts,
  registerAllThemes,
  registerQuotes,
  registerAvatar,
  registerFormats,
  registerDiscord,
  registerMisskey,
  registerTwitter,
  registerMarkdown,
  registerColors,
  registerSizing,
  registerChain,
]

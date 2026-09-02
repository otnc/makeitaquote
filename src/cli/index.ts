import { cli, command } from 'cleye'
import { oneOf } from 'cleye/formats'
import {
  type CliDeps,
  type CliIo,
  defaultIo,
  envCommand,
  installCommand,
  listCommand,
  outdatedCommand,
  pruneCommand,
  renderCommand,
  searchCommand,
  uninstallCommand,
  updateCommand,
} from './commands'
import { currentVersion } from './packageVersion'

export type { CliDeps, CliIo } from './commands'

const DESCRIPTION =
  'Manage the assets makeitaquote keeps on disk, for offline use. Storage ' +
  'defaults to <project root>/.makeitaquote — override with MIQ_FONT_CACHE_DIR ' +
  'and MIQ_TWEMOJI_CACHE_DIR. Also available as `makeitaquote <command>`.'

/** Shared by every read-only reporting command. */
const JSON_FLAG = {
  json: { type: Boolean, description: 'Print machine-readable JSON instead' },
}

/**
 * Runs one command line, returning the process exit code.
 *
 * Command bodies (`install`/`uninstall`/`ls`/`search`/`outdated`, all in
 * `./commands`) are pure orchestration through `deps`/`io`, and that's the
 * whole testable surface: argv parsing, aliases, and `--help`/`--version`
 * are cleye's job, generated from the `help`/`alias` fields below rather
 * than a hand-written usage string. Those three paths print straight to the
 * console and call `process.exit()` internally — exactly what a real CLI
 * should do, but not something to route through `io` or await here.
 */
export async function run(
  argv: readonly string[],
  deps: CliDeps = {},
  io: CliIo = defaultIo,
): Promise<number> {
  let exitCode = 0

  const install = command(
    {
      name: 'install',
      alias: ['add', 'i'],
      parameters: ['[targets...]'],
      flags: {
        noFallback: {
          type: Boolean,
          description:
            'Skip the automatic script-fallback fonts (Nanum Gothic, Chiron GoRound TC, Noto ' +
            'Sans SC, IBM Plex Sans Arabic) — only fonts selectable with `font=`. No effect on ' +
            'a specific family.',
        },
      },
      help: {
        description:
          'Download assets so rendering works offline. With no target, installs Twemoji ' +
          'and the default fonts; "all" installs Twemoji and every catalogued font ' +
          '(`miq search`) instead. Other targets: "twemoji"/"emoji" for just Twemoji, ' +
          '"fonts"/"font" for just the default families, or a specific family name — a ' +
          'FONT_ALIASES short name (`pop`) works too.',
        examples: [
          'miq install',
          'miq install all',
          'miq install all --no-fallback',
          'miq install twemoji',
          'miq install emoji',
          'miq install fonts',
          'miq install fonts "Dela Gothic One"',
          'miq install "Dela Gothic One"',
          'miq install pop',
        ],
      },
    },
    async (parsed) => {
      exitCode = await installCommand(parsed._.targets, deps, io, {
        noFallback: parsed.flags.noFallback,
      })
    },
  )

  const uninstall = command(
    {
      name: 'uninstall',
      alias: ['remove', 'rm', 'r', 'un', 'unlink'],
      parameters: ['[targets...]'],
      help: {
        description:
          'Delete downloaded assets. "all" and no target both mean everything — unlike ' +
          'install, removing does not care which fonts are catalogued. Other targets: ' +
          '"twemoji"/"emoji", "fonts"/"font", or a specific family name (a FONT_ALIASES ' +
          'short name works too).',
        examples: [
          'miq uninstall',
          'miq uninstall all',
          'miq uninstall twemoji',
          'miq uninstall emoji',
          'miq uninstall fonts',
          'miq uninstall fonts "Dela Gothic One"',
        ],
      },
    },
    async (parsed) => {
      exitCode = await uninstallCommand(parsed._.targets, deps, io)
    },
  )

  const ls = command(
    {
      name: 'ls',
      alias: 'list',
      flags: JSON_FLAG,
      help: {
        description: 'List what is installed — Twemoji included — how much it takes, and where.',
      },
    },
    async (parsed) => {
      exitCode = await listCommand(deps, io, { json: parsed.flags.json })
    },
  )

  const search = command(
    {
      name: 'search',
      alias: ['find', 's'],
      parameters: ['[query]'],
      flags: JSON_FLAG,
      help: {
        description:
          'List fonts miq knows how to install by name. Any Google Fonts family also ' +
          'works whether or not it is listed.',
        examples: ['miq search', 'miq search gothic'],
      },
    },
    (parsed) => {
      exitCode = searchCommand(parsed._.query, io, { json: parsed.flags.json })
    },
  )

  const outdated = command(
    {
      name: 'outdated',
      flags: JSON_FLAG,
      help: {
        description:
          'Check miq, Twemoji, and every installed font against what is currently published.',
        examples: ['miq outdated'],
      },
    },
    async (parsed) => {
      exitCode = await outdatedCommand(deps, io, { json: parsed.flags.json })
    },
  )

  const update = command(
    {
      name: 'update',
      help: {
        description:
          'Apply what `outdated` finds: update Twemoji and any outdated font, in place. ' +
          'Never touches the miq install itself — that always prints a command to run yourself.',
        examples: ['miq update'],
      },
    },
    async () => {
      exitCode = await updateCommand(deps, io)
    },
  )

  const prune = command(
    {
      name: 'prune',
      parameters: ['[families...]'],
      help: {
        description:
          'Delete stale-version font files, keeping the newest per family. With no target, ' +
          'checks every installed family.',
        examples: ['miq prune', 'miq prune "Dela Gothic One"'],
      },
    },
    async (parsed) => {
      exitCode = await pruneCommand(parsed._.families, deps, io)
    },
  )

  const env = command(
    {
      name: 'env',
      alias: 'doctor',
      flags: JSON_FLAG,
      help: {
        description:
          'Show where fonts/Twemoji are stored, whether that location is writable, and ' +
          'whether the hosts miq talks to are reachable.',
        examples: ['miq env'],
      },
    },
    async (parsed) => {
      exitCode = await envCommand(deps, io, { json: parsed.flags.json })
    },
  )

  const render = command(
    {
      name: 'generate',
      alias: 'render',
      flags: {
        text: { type: String, description: 'The quoted text (required)' },
        avatar: {
          type: String,
          description: 'An avatar URL, a local image file, or - to read stdin',
        },
        username: { type: String, description: '@handle line' },
        displayName: { type: String, description: 'Display/nickname line' },
        watermark: { type: String, description: 'Small corner text' },
        watermarkImage: {
          type: String,
          description:
            'A watermark image URL, a local image file, or - to read stdin ' +
            '(mutually exclusive with --watermark)',
        },
        color: {
          type: Boolean,
          description: 'Keep the avatar in color instead of desaturating it',
        },
        theme: {
          type: oneOf('dark', 'light', 'custom'),
          description: 'A built-in color palette (default: dark)',
        },
        layout: {
          type: oneOf('side', 'new'),
          description: 'side by side, or new: full-bleed, fading downwards (default: side)',
        },
        scale: { type: Number, description: 'Resize the whole image, keeping its layout (max 8)' },
        format: {
          type: oneOf('png', 'jpeg', 'jpg', 'webp', 'avif'),
          default: 'png',
          description: 'Output image format',
        },
        quality: { type: Number, description: '1-100, ignored for png (default 92)' },
        out: { type: String, description: 'Where to write the image (default: quote.<format>)' },
        offline: { type: Boolean, description: 'Never fetch a font — use what is already on disk' },
      },
      help: {
        description: 'Generate a quote image and write it to disk.',
        examples: [
          'miq generate --text "吾輩は猫である。" --avatar https://…/avatar.png --out quote.png',
          'miq generate --text "Hello" --theme light --format webp',
          'miq generate --text "Hello" --layout new',
          'miq generate --text "Hello" --watermark-image ./logo.png',
          'cat logo.png | miq generate --text "Hello" --watermark-image -',
        ],
      },
    },
    async (parsed) => {
      exitCode = await renderCommand(parsed.flags, deps, io)
    },
  )

  await cli(
    {
      name: 'miq',
      version: currentVersion(),
      help: { description: DESCRIPTION },
      commands: [install, uninstall, ls, search, outdated, update, prune, env, render],
    },
    (root) => {
      // Only reached when no command matched: nothing was typed, the first
      // word was `help` (cleye has no built-in alias for that), or it was
      // something unrecognized.
      if (root._.length > 0 && root._[0] !== 'help') {
        io.line(`Unknown command: ${root._[0]}`)
        io.line('')
        exitCode = 1
      }
      root.showHelp()
    },
    [...argv],
  )

  return exitCode
}

import { cli, command } from 'cleye'
import {
  type CliDeps,
  type CliIo,
  defaultIo,
  installCommand,
  listCommand,
  outdatedCommand,
  searchCommand,
  uninstallCommand,
} from './commands'
import { currentVersion } from './packageVersion'

export type { CliDeps, CliIo } from './commands'

const DESCRIPTION =
  'Manage the assets makeitaquote keeps on disk, for offline use. Storage ' +
  'defaults to <project root>/.makeitaquote — override with MIQ_FONT_CACHE_DIR ' +
  'and MIQ_TWEMOJI_CACHE_DIR. Also available as `makeitaquote <command>`.'

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
      help: {
        description:
          'Download assets so rendering works offline. With no target, installs ' +
          'everything: Twemoji and the default fonts.',
        examples: [
          'miq install',
          'miq install twemoji',
          'miq install fonts',
          'miq install fonts "Dela Gothic One"',
          'miq install "Dela Gothic One"',
        ],
      },
    },
    async (parsed) => {
      exitCode = await installCommand(parsed._.targets, deps, io)
    },
  )

  const uninstall = command(
    {
      name: 'uninstall',
      alias: ['remove', 'rm', 'un'],
      parameters: ['[targets...]'],
      help: {
        description: 'Delete downloaded assets. With no target, removes everything.',
        examples: [
          'miq uninstall',
          'miq uninstall twemoji',
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
      help: {
        description: 'List what is installed — Twemoji included — how much it takes, and where.',
      },
    },
    async () => {
      exitCode = await listCommand(deps, io)
    },
  )

  const search = command(
    {
      name: 'search',
      alias: ['find', 's'],
      parameters: ['[query]'],
      help: {
        description:
          'List fonts miq knows how to install by name. Any Google Fonts family also ' +
          'works whether or not it is listed.',
        examples: ['miq search', 'miq search gothic'],
      },
    },
    (parsed) => {
      exitCode = searchCommand(parsed._.query, io)
    },
  )

  const outdated = command(
    {
      name: 'outdated',
      help: {
        description:
          'Check miq, Twemoji, and every installed font against what is currently published.',
        examples: ['miq outdated'],
      },
    },
    async () => {
      exitCode = await outdatedCommand(deps, io)
    },
  )

  await cli(
    {
      name: 'miq',
      version: currentVersion(),
      help: { description: DESCRIPTION },
      commands: [install, uninstall, ls, search, outdated],
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

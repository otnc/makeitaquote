import { parseArgs } from 'node:util'

// `parseArgs` reports an unknown flag rather than ignoring it — a typo in
// `--only` used to just render nothing.
export function parseCli() {
  const { values } = parseArgs({
    options: {
      offline: { type: 'boolean', default: false },
      out: { type: 'string', default: 'docs/visual' },
      only: { type: 'string', default: '' },
    },
    allowPositionals: true,
  })

  return {
    offline: values.offline,
    out: values.out,
    only: values.only
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  }
}

const warned = new Set<string>()

/**
 * Warns once per process that an API is deprecated.
 *
 * Modelled on how discord.js does it: a `DeprecationWarning` through
 * `process.emitWarning`, so it shows up with a stack trace under
 * `--trace-warnings` and can be silenced with `--no-deprecation` like any
 * other Node deprecation — rather than being a `console.warn` a bot author has
 * no standard way to turn off.
 */
export function deprecate(code: string, message: string): void {
  if (warned.has(code)) return
  warned.add(code)

  process.emitWarning(message, {
    type: 'DeprecationWarning',
    code,
  })
}

/** Test seam: lets a deprecation fire again. */
export function resetDeprecationsForTests(): void {
  warned.clear()
}

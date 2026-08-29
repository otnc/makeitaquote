/** A human-readable message for anything caught from a `try`/`catch` — not every `throw` is an `Error`. */
export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/**
 * Whether `latest` is a real step forward from `current`.
 *
 * Not full semver — just as much as comparing `9.0.1` to `9.1.0`, or a Google
 * Fonts asset tag like `v30` to `v31`, needs: numeric segments, left to
 * right, missing ones treated as zero. A leading `v` is stripped so both
 * shapes compare the same way.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const a = toSegments(current)
  const b = toSegments(latest)
  const length = Math.max(a.length, b.length)

  for (let i = 0; i < length; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (y !== x) return y > x
  }

  return false
}

function toSegments(version: string): number[] {
  return version
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((n) => (Number.isFinite(n) ? n : 0))
}

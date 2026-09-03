/**
 * Whether `latest` is a real step forward from `current`.
 *
 * Not full semver — just as much as comparing `9.0.1` to `9.1.0`, or a Google Fonts asset tag like `v30` to `v31`, needs: numeric segments, left to right, missing ones treated as zero. A leading `v` is stripped so both shapes compare the same way.
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
  // Drop any prerelease/build suffix (`-rc.1`, `+build5`) before splitting on `.`: left in, "12.0.0-rc.1" parsed as [12, 0, 0, 1] — parseInt truncates "0-rc" down to the digits it starts with, so the trailing ".1" became a real extra segment, making the prerelease compare as *newer* than the release it precedes. Comparing bare cores instead can't tell a prerelease apart from its release, but that's a smaller, safer imprecision than the reversal — and every real caller here (npm dist-tags, Twemoji/Google Fonts release tags) is a plain core version.
  const core = version.replace(/^v/, '').split(/[-+]/)[0] as string

  return core
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((n) => (Number.isFinite(n) ? n : 0))
}

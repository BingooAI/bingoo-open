/** Semver cho FrameworkVersion. SPEC §9.1. */

import type { FrameworkReleaseType } from '../domain'

export interface Semver {
  readonly major: number
  readonly minor: number
  readonly patch: number
}

export function compareSemver(a: Semver, b: Semver): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

/** SPEC §9.1 — bump theo releaseType; không có bản trước → 1.0.0. */
export function nextSemver(latest: Semver | null, releaseType: FrameworkReleaseType): Semver {
  if (!latest) return { major: 1, minor: 0, patch: 0 }
  if (releaseType === 'MAJOR') return { major: latest.major + 1, minor: 0, patch: 0 }
  if (releaseType === 'MINOR') return { major: latest.major, minor: latest.minor + 1, patch: 0 }
  return { major: latest.major, minor: latest.minor, patch: latest.patch + 1 } // PATCH
}

export function formatSemver(v: Semver): string {
  return `${v.major}.${v.minor}.${v.patch}`
}

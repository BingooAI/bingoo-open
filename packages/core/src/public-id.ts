/**
 * `publicId` — the immutable, public-facing identifier for a User (§3.1).
 *
 * Safe to display and share (QR, support, referral): it is minted from a CSPRNG
 * so it reveals NO creation order or sequence (unlike an auto-increment or a
 * time-ordered ULID) and cannot be enumerated. Format: `BG` + Crockford base32.
 *
 * Platform-agnostic (R2): uses the Web Crypto global available in browsers and
 * Node ≥ 20 — never `node:crypto`. Uniqueness is additionally guaranteed by the
 * `User.publicId` unique constraint; at 60 bits a collision is astronomically
 * unlikely, but the DB constraint is the backstop.
 */

// Web Crypto is a global in every runtime we ship to; declared narrowly here
// because @bingoo.ai/core's tsconfig ships no DOM/Node lib.
declare const crypto: { getRandomValues<T extends Uint8Array>(array: T): T }

/** Crockford base32 — omits I, L, O, U (ambiguity + accidental words). */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const PUBLIC_ID_PREFIX = 'BG'
/** Random chars after the prefix — 12 × 5 bits = 60 bits of entropy. */
export const PUBLIC_ID_LENGTH = 12

/** Mint a fresh public id, e.g. `BG7K2M9QX4TB`. */
export function mintPublicId(length: number = PUBLIC_ID_LENGTH): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) {
    // Low 5 bits are uniform over 0–31 (256 is a multiple of 32).
    out += CROCKFORD.charAt(byte & 31)
  }
  return PUBLIC_ID_PREFIX + out
}

// Uppercase Crockford, prefix + 10–24 chars (range leaves room to widen later
// without invalidating existing ids).
const PUBLIC_ID_RE = /^BG[0-9A-HJKMNP-TV-Z]{10,24}$/

/** True when `value` is a well-formed public id (canonical uppercase form). */
export function isPublicId(value: string): boolean {
  return PUBLIC_ID_RE.test(value)
}

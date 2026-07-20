/**
 * Age tier + age-of-consent logic (§3.3, §3.7) and the synthetic-email helper
 * for children (§3.6). Platform-agnostic (R2): pure functions, no I/O.
 *
 * The consent-age table is in-code for now; P3 moves it to remote config (R6) so
 * thresholds change without a release. Below the consent age a user is a CHILD
 * (needs verifiable guardian consent); consent-age..17 is a TEEN; ≥18 is ADULT.
 */

export type AccountType = 'CHILD' | 'TEEN' | 'ADULT'

/** Age-of-consent thresholds by country + a fallback (§3.7). The shape stored in
 *  remote config under `age_of_consent`; the API resolves it and passes it in so
 *  this module stays pure (no I/O). */
export interface ConsentAgeConfig {
  /** Consent age per country (ISO-3166 alpha-2, uppercase). */
  byCountry: Record<string, number>
  /** Fallback for unlisted countries (EU default). */
  default: number
}

/** Fallback consent age (EU default + everywhere unconfigured) — §3.7. */
export const DEFAULT_CONSENT_AGE = 16
/** Full legal adulthood, every country. */
export const ADULT_AGE = 18

/** In-code defaults; remote config (§R6) overrides these at runtime (P3). */
export const DEFAULT_CONSENT_CONFIG: ConsentAgeConfig = {
  byCountry: {
    VN: 16, // Luật Trẻ em + PDPD 2023
    US: 13, // COPPA
    GB: 13,
  },
  default: DEFAULT_CONSENT_AGE,
}

/** Consent age for a country (ISO-3166 alpha-2, case-insensitive). */
export function consentAge(
  country: string | null | undefined,
  config: ConsentAgeConfig = DEFAULT_CONSENT_CONFIG,
): number {
  if (!country) return config.default
  return config.byCountry[country.toUpperCase()] ?? config.default
}

/** Whole years from `dob` to `now` (default now). */
export function ageInYears(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear()
  const monthDelta = now.getMonth() - dob.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1
  return age
}

/** Derive the age tier from date of birth + country + consent config (§3.3). */
export function deriveAccountType(
  dob: Date,
  country: string | null | undefined,
  config: ConsentAgeConfig = DEFAULT_CONSENT_CONFIG,
  now: Date = new Date(),
): AccountType {
  const age = ageInYears(dob, now)
  if (age >= ADULT_AGE) return 'ADULT'
  if (age >= consentAge(country, config)) return 'TEEN'
  return 'CHILD'
}

/** Subdomain that holds children's identity-only emails (never delivers mail). */
export const SYNTH_EMAIL_DOMAIN = 'id.bingoo.ai'

/** Build a child's synthetic email from their publicId (§3.6). */
export function synthEmail(publicId: string): string {
  return `${publicId.toLowerCase()}@${SYNTH_EMAIL_DOMAIN}`
}

/** True for that synthetic identity-only address (no real mailbox). */
export function isSynthEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${SYNTH_EMAIL_DOMAIN}`)
}

/** A child login PIN: exactly 6 digits. */
export function isPin(value: string): boolean {
  return /^\d{6}$/.test(value)
}

/** A child username: 3–30 chars, lowercase letters/digits/underscore. */
export function isUsername(value: string): boolean {
  return /^[a-z0-9_]{3,30}$/.test(value)
}

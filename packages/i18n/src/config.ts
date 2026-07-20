/**
 * Single source of truth for supported locales — shared by every platform.
 * Add a locale here + a matching `messages/<code>.json` and it flows everywhere
 * (web routing/middleware/switcher, mobile picker). Framework-agnostic on purpose.
 */
export const locales = ['vi', 'en'] as const
export const defaultLocale = 'vi' satisfies (typeof locales)[number]

export type Locale = (typeof locales)[number]

/** Type guard: is this string one of our supported locales? */
export function isValidLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value)
}

/** Human labels + native names + text direction (used by the locale switcher). */
export const localeMeta: Record<Locale, { label: string; native: string; dir: 'ltr' | 'rtl' }> = {
  vi: { label: 'Vietnamese', native: 'Tiếng Việt', dir: 'ltr' },
  en: { label: 'English', native: 'English', dir: 'ltr' },
}

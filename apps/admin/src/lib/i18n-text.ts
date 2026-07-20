import type { LocalizedText } from '@bingoo/core'

/**
 * Render a localized JSON value ({vi,en,…}) for the active locale, with a safe
 * fallback chain: requested locale → vi → en → first available → ''. Backend
 * `title`/`name`/`label` columns are all this shape (R4).
 */
export function pickText(value: LocalizedText | null | undefined, locale: string, fallback = ''): string {
  if (!value) return fallback
  return (
    value[locale] ??
    value.vi ??
    value.en ??
    Object.values(value).find((v) => typeof v === 'string' && v.length > 0) ??
    fallback
  )
}

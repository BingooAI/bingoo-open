import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from '@bingoo/i18n';

// Locale list + metadata live in the shared @bingoo/i18n package (used by web &
// mobile too). This module is the admin-only next-intl wiring on top of them.
export { isValidLocale, localeMeta, type Locale } from '@bingoo/i18n';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeCookie: {
    name: 'BINGOO_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
  },
});

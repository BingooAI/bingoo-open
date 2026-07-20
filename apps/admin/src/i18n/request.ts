import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isValidLocale, messages } from '@bingoo/i18n';

/**
 * Per-request i18n config consumed by the next-intl plugin.
 * Message catalog comes from the shared @bingoo/i18n package (namespace `admin`).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isValidLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: messages[locale],
    now: new Date(),
  };
});

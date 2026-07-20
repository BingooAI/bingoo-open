import { routing } from '@/i18n/routing';

/**
 * Global fallback for paths that never entered the [locale] segment. It renders
 * outside the locale layout, so it must be a self-contained document. We simply
 * bounce to the default-locale home, where the friendly localized 404 lives.
 */
export default function GlobalNotFound() {
  const url = `/${routing.defaultLocale}`;
  return (
    <html lang={routing.defaultLocale}>
      <head>
        <meta httpEquiv="refresh" content={`0; url=${url}`} />
      </head>
      <body style={{ fontFamily: 'system-ui, sans-serif' }}>
        <a href={url}>Bingoo →</a>
      </body>
    </html>
  );
}

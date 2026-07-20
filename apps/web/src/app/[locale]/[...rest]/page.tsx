import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

/**
 * Catch-all for any unmatched path *inside* a locale. It throws `notFound()`,
 * which renders the friendly localized `[locale]/not-found.tsx` (real routes
 * always take priority over this catch-all).
 */
export default async function CatchAll({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  notFound();
}

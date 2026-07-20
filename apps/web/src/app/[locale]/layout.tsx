import type { Metadata, Viewport } from 'next'
import { Baloo_2, Be_Vietnam_Pro } from 'next/font/google'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { themeColor } from '@bingoo/tokens'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { isValidLocale, routing } from '@/i18n/routing'
import '../globals.css'

// Display font. Baloo 2 — the official Bingoo brand display face (chunky, rounded
// terminals that echo the wordmark). Ships a full `vietnamese` subset so
// diacritics never fall back mid-word.
const baloo = Baloo_2({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-baloo',
  display: 'swap',
})

const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
})

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta' })
  return {
    metadataBase: new URL('https://bingoo.ai'),
    title: { default: t('title'), template: '%s · Bingoo' },
    description: t('description'),
    applicationName: 'Bingoo',
    icons: {
      icon: [
        { url: '/favicon/favicon.svg', type: 'image/svg+xml' },
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/favicon/favicon-32.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: '/favicon/apple-touch-icon.png',
    },
    openGraph: {
      type: 'website',
      siteName: 'Bingoo',
      title: t('title'),
      description: t('description'),
    },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: themeColor.light },
    { media: '(prefers-color-scheme: dark)', color: themeColor.dark },
  ],
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isValidLocale(locale)) notFound()

  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning className={`${baloo.variable} ${beVietnam.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

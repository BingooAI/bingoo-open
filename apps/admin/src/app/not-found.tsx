// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { Baloo_2, Be_Vietnam_Pro } from 'next/font/google'
import '@/app/globals.css'

const baloo = Baloo_2({ subsets: ['latin'], weight: ['700'], variable: '--font-baloo' })
const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-be-vietnam',
})

/**
 * Global not-found (outside the [locale] tree, so it owns its own <html>). Kept
 * locale-free on purpose — an unmatched path has no resolved locale.
 */
export default function NotFound() {
  return (
    <html lang="vi" className={`${baloo.variable} ${beVietnam.variable}`} suppressHydrationWarning>
      <body className="grid min-h-dvh place-items-center bg-background p-8 text-foreground antialiased">
        <div className="text-center">
          <p className="font-display text-6xl font-bold text-primary">404</p>
          <p className="mt-3 text-foreground-muted">Not found</p>
          <a
            href="/"
            className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Bingoo Admin
          </a>
        </div>
      </body>
    </html>
  )
}

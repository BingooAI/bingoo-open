// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useLocale, useTranslations } from 'next-intl'
import { signIn } from '@/lib/auth-client'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.88h3.72c2.18-2 3.44-4.96 3.44-8.55Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.1 0 5.7-1.03 7.6-2.78l-3.72-2.88c-1.03.69-2.35 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.72H1.76v2.97A11.99 11.99 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.6 14.72a7.2 7.2 0 0 1 0-4.44V7.31H1.76a12 12 0 0 0 0 10.38l3.84-2.97Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.68 0 3.19.58 4.38 1.71l3.28-3.28C17.7 1.2 15.1 0 12 0A11.99 11.99 0 0 0 1.76 7.31l3.84 2.97C6.5 6.76 9.02 4.75 12 4.75Z"
      />
    </svg>
  )
}

// Only Google is wired — the API's OAuth provider (§3.4). Add more when the API
// gains them, so we never show a button that can't complete.
export function SocialButtons() {
  const t = useTranslations('auth.shared')
  const locale = useLocale()

  function continueWithGoogle() {
    // Redirects to Google; the API handles the callback then returns here.
    void signIn.social({
      provider: 'google',
      callbackURL: `${window.location.origin}/${locale}/student`,
    })
  }

  return (
    <button
      type="button"
      onClick={continueWithGoogle}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <GoogleIcon />
      {t('continueWith', { provider: 'Google' })}
    </button>
  )
}

export function AuthDivider() {
  const t = useTranslations('auth.shared')
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">{t('or')}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'
import { AuthHeader } from '@/components/auth/auth-header'
import { Button, Field, Input, IconChip } from '@bingoo.ai/ui-web'
import { Link } from '@/i18n/navigation'
import { requestPasswordReset } from '@/lib/auth-client'
import { authErrorKey } from '@/lib/auth-errors'
import { isEmail } from '@bingoo.ai/core'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth')
  const tv = useTranslations('validation')
  const locale = useLocale()

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isEmail(email)) {
      setError(tv('email'))
      return
    }
    setError(undefined)
    setLoading(true)
    // The reset email links back to our /reset-password page (locale-aware).
    const redirectTo = `${window.location.origin}/${locale}/reset-password`
    const res = await requestPasswordReset({ email, redirectTo }).catch(() => null)
    setLoading(false)
    if (!res || res.error) {
      setError(t(`errors.${res ? authErrorKey(res.error?.code) : 'network'}`))
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center">
        <IconChip color="success" size="lg" className="mx-auto">
          <MailCheck />
        </IconChip>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground">
          {t('forgot.sentTitle')}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-foreground-muted">
          {t.rich('forgot.sentSubtitle', {
            email,
            b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
          })}
        </p>
        <p className="mt-4 text-sm text-foreground-subtle">{t('forgot.checkSpam')}</p>

        <div className="mt-8 flex flex-col gap-3">
          <Button variant="secondary" size="lg" fullWidth onClick={() => setSent(false)}>
            {t('forgot.resend')}
          </Button>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="size-4" />
            {t('forgot.backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <AuthHeader
        emotion="thinking"
        bubble={t('forgot.mascot')}
        title={t('forgot.title')}
        subtitle={t('forgot.subtitle')}
      />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label={t('shared.email')} error={error}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            inputSize="lg"
            placeholder={t('shared.emailPlaceholder')}
            leftIcon={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-2">
          {t('forgot.submit')}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-foreground-muted">
        {t('forgot.remembered')}{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t('forgot.backToLogin')}
        </Link>
      </p>
    </div>
  )
}

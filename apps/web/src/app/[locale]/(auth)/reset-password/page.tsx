// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState, type FormEvent } from 'react'
import { AuthHeader } from '@/components/auth/auth-header'
import { Button, Field, PasswordInput, IconChip } from '@bingoo.ai/ui-web'
import { Link } from '@/i18n/navigation'
import { resetPassword } from '@/lib/auth-client'
import { authErrorKey } from '@/lib/auth-errors'

function ResetForm() {
  const t = useTranslations('auth')
  const tv = useTranslations('validation')
  const token = useSearchParams().get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [formError, setFormError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // No token → the link is malformed/expired.
  if (!token) {
    return (
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          {t('reset.invalidTitle')}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-foreground-muted">{t('reset.invalidSubtitle')}</p>
        <Link
          href="/forgot-password"
          className="mt-8 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          {t('reset.requestNew')}
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="text-center">
        <IconChip color="success" size="lg" className="mx-auto">
          <CheckCircle2 />
        </IconChip>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground">
          {t('reset.successTitle')}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-foreground-muted">{t('reset.successSubtitle')}</p>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t('reset.goToLogin')}
        </Link>
      </div>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (password.length < 8) next.password = tv('passwordWeak')
    if (confirm !== password) next.confirm = tv('passwordMismatch')
    setErrors(next)
    if (Object.keys(next).length) return

    setFormError(undefined)
    setLoading(true)
    const res = await resetPassword({ newPassword: password, token }).catch(() => null)
    if (!res || res.error) {
      setLoading(false)
      setFormError(t(`errors.${res ? authErrorKey(res.error?.code) : 'network'}`))
      return
    }
    setDone(true)
  }

  return (
    <div>
      <AuthHeader
        emotion="thinking"
        bubble={t('reset.mascot')}
        title={t('reset.title')}
        subtitle={t('reset.subtitle')}
      />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label={t('reset.newPassword')} error={errors.password}>
          <PasswordInput
            name="password"
            autoComplete="new-password"
            inputSize="lg"
            placeholder={t('shared.passwordPlaceholder')}
            showLabel={t('shared.showPassword')}
            hideLabel={t('shared.hidePassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Field label={t('reset.confirmPassword')} error={errors.confirm}>
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            inputSize="lg"
            placeholder={t('shared.passwordPlaceholder')}
            showLabel={t('shared.showPassword')}
            hideLabel={t('shared.hidePassword')}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>

        {formError && (
          <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-2">
          {t('reset.submit')}
        </Button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  )
}

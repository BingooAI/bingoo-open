'use client'

import { Mail, ShieldAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState, type FormEvent } from 'react'
import { isEmail } from '@bingoo.ai/core'
import { Button, Field, Input, PasswordInput } from '@bingoo.ai/ui-web'
import { useRouter } from '@/i18n/navigation'
import { signIn } from '@/lib/auth-client'
import { authErrorKey } from '@/lib/auth-errors'

function LoginForm() {
  const t = useTranslations('admin.login')
  const te = useTranslations('auth.errors')
  const tv = useTranslations('validation')
  const ts = useTranslations('auth.shared')
  const router = useRouter()
  const searchParams = useSearchParams()
  const denied = searchParams.get('denied') === '1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string>()
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!isEmail(email)) next.email = tv('email')
    if (password.length < 8) next.password = tv('passwordWeak')
    setErrors(next)
    if (Object.keys(next).length) return

    setFormError(undefined)
    setLoading(true)
    const res = await signIn.email({ email, password }).catch(() => null)
    if (!res || res.error) {
      setLoading(false)
      setFormError(te(res ? authErrorKey(res.error?.code) : 'network'))
      return
    }
    // Staff gating is enforced server-side on /media (requireStaff); a non-staff
    // account is bounced back here with ?denied=1.
    router.push('/media')
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1.5 text-sm text-foreground-muted">{t('subtitle')}</p>
      </div>

      {denied && (
        <p
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          {t('denied')}
        </p>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label={ts('email')} error={errors.email}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            inputSize="lg"
            placeholder={ts('emailPlaceholder')}
            leftIcon={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label={ts('password')} error={errors.password}>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            inputSize="lg"
            placeholder={ts('passwordPlaceholder')}
            showLabel={ts('showPassword')}
            hideLabel={ts('hidePassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {formError && (
          <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-2">
          {t('submit')}
        </Button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

'use client';

import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthDivider, SocialButtons } from '@/components/auth/social-buttons';
import { Button, Checkbox, Field, Input, PasswordInput } from '@bingoo/ui-web';
import { Link, useRouter } from '@/i18n/navigation';
import { signIn } from '@/lib/auth-client';
import { authErrorKey } from '@/lib/auth-errors';
import { isEmail } from '@bingoo/core';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tv = useTranslations('validation');
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isEmail(email)) next.email = tv('email');
    if (password.length < 8) next.password = tv('passwordWeak');
    setErrors(next);
    if (Object.keys(next).length) return;

    setFormError(undefined);
    setLoading(true);
    const res = await signIn.email({ email, password }).catch(() => null);
    if (!res || res.error) {
      setLoading(false);
      setFormError(t(`errors.${res ? authErrorKey(res.error?.code) : 'network'}`));
      return;
    }
    router.push('/student');
  }

  return (
    <div>
      <AuthHeader
        emotion="happy"
        bubble={t('login.mascot')}
        title={t('login.title')}
        subtitle={t('login.subtitle')}
      />

      <SocialButtons />
      <div className="my-6">
        <AuthDivider />
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label={t('shared.email')} error={errors.email}>
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

        <Field label={t('shared.password')} error={errors.password}>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            inputSize="lg"
            placeholder={t('shared.passwordPlaceholder')}
            showLabel={t('shared.showPassword')}
            hideLabel={t('shared.hidePassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <div className="flex items-center justify-between">
          <Checkbox label={t('shared.rememberMe')} name="remember" defaultChecked />
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t('login.forgot')}
          </Link>
        </div>

        {formError && (
          <p
            role="alert"
            className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
          >
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-2">
          {t('login.submit')}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-foreground-muted">
        {t('login.noAccount')}{' '}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          {t('login.signupLink')}
        </Link>
      </p>
    </div>
  );
}

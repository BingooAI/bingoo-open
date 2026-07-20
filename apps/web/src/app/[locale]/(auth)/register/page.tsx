'use client';

import { Mail, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthDivider, SocialButtons } from '@/components/auth/social-buttons';
import {
  Button,
  Checkbox,
  Field,
  Input,
  PasswordInput,
  SegmentedControl,
  IconChip,
} from '@bingoo/ui-web';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { signUp } from '@/lib/auth-client';
import { authErrorKey } from '@/lib/auth-errors';
import { isEmail } from '@bingoo/core';

type Role = 'parent' | 'student';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tv = useTranslations('validation');
  const router = useRouter();

  const [role, setRole] = useState<Role>('parent');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    agreed?: string;
  }>({});
  const [formError, setFormError] = useState<string>();
  const [verifySent, setVerifySent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = tv('required');
    if (!isEmail(email)) next.email = tv('email');
    if (password.length < 8) next.password = tv('passwordWeak');
    if (!agreed) next.agreed = tv('agreeTerms');
    setErrors(next);
    if (Object.keys(next).length) return;

    setFormError(undefined);
    setLoading(true);
    const res = await signUp.email({ name, email, password }).catch(() => null);
    if (!res || res.error) {
      setLoading(false);
      setFormError(t(`errors.${res ? authErrorKey(res.error?.code) : 'network'}`));
      return;
    }
    // A session token means auto sign-in (email verification off) → onboard now;
    // otherwise the account awaits email verification.
    if (res.data?.token) router.push('/onboarding');
    else setVerifySent(true);
  }

  if (verifySent) {
    return (
      <div className="text-center">
        <IconChip color="success" size="lg" className="mx-auto">
          <MailCheck />
        </IconChip>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground">
          {t('verify.title')}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-foreground-muted">
          {t.rich('verify.subtitle', {
            email,
            b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
          })}
        </p>
        <p className="mt-4 text-sm text-foreground-subtle">{t('verify.checkSpam')}</p>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t('verify.backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <AuthHeader
        emotion="excited"
        bubble={t('register.mascot')}
        title={t('register.title')}
        subtitle={t('register.subtitle')}
      />

      <SocialButtons />
      <div className="my-6">
        <AuthDivider />
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label={t('register.roleQuestion')}>
          <SegmentedControl<Role>
            aria-label={t('register.roleQuestion')}
            value={role}
            onChange={setRole}
            options={[
              { value: 'parent', label: t('register.roleParent') },
              { value: 'student', label: t('register.roleStudent') },
            ]}
          />
        </Field>

        <Field label={t('shared.name')} error={errors.name}>
          <Input
            name="name"
            autoComplete="name"
            inputSize="lg"
            placeholder={t('shared.namePlaceholder')}
            leftIcon={<User />}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

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

        <Field
          label={t('shared.password')}
          error={errors.password}
          hint={t('shared.passwordPlaceholder')}
        >
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

        <div className="flex flex-col gap-1.5">
          <Checkbox
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            label={t.rich('register.terms', {
              terms: (chunks) => (
                <Link href="/" className="font-semibold text-primary hover:underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/" className="font-semibold text-primary hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          />
          {errors.agreed && (
            <p role="alert" className="pl-8 text-xs font-medium text-danger">
              {errors.agreed}
            </p>
          )}
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
          {t('register.submit')}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-foreground-muted">
        {t('register.haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t('register.loginLink')}
        </Link>
      </p>
    </div>
  );
}

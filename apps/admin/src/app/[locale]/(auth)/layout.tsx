import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { LocaleSwitcher } from '@/components/brand/locale-switcher';
import { ThemeToggle } from '@/components/brand/theme-toggle';

/**
 * Admin auth layout — a calm, staff-facing sign-in surface (no marketing). The
 * admin app is a separate origin from the main app, so it owns its own login;
 * the session cookie is set here via the /api/auth proxy.
 */
export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-surface-muted">
      <TopBar />
      <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

function TopBar() {
  const t = useTranslations('admin');
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
      <div className="flex items-center gap-2">
        <Logo variant="mark" height={28} />
        <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-foreground-muted">
          <ShieldCheck className="size-4" />
          {t('brand')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </div>
  );
}

import { ArrowLeft, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { LocaleSwitcher } from '@/components/brand/locale-switcher';
import { Mascot } from '@/components/brand/mascot';
import { ThemeToggle } from '@/components/brand/theme-toggle';
import { Link } from '@/i18n/navigation';

function BrandPanel() {
  const t = useTranslations();
  const highlights = [
    { Icon: Sparkles, text: t('landing.features.items.personalized.title') },
    { Icon: Star, text: t('landing.features.items.gamified.title') },
    { Icon: ShieldCheck, text: t('landing.features.items.safe.title') },
  ];

  return (
    <aside className="relative hidden overflow-hidden bg-gradient-brand p-10 lg:flex lg:flex-col">
      <div aria-hidden className="absolute inset-0 bg-dots opacity-15" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-1/4 size-72 rounded-full bg-white/10 blur-2xl"
      />

      <div className="relative">
        <Link href="/" className="inline-flex">
          <Logo variant="mark" height={40} />
        </Link>
      </div>

      <div className="relative my-auto flex flex-col items-start">
        <Mascot emotion="graduate" size={200} float alt="" />
        <h2 className="mt-6 max-w-sm font-display text-3xl font-bold leading-tight text-white">
          {t('common.tagline')}
        </h2>
        <p className="mt-3 max-w-sm text-white/85">{t('landing.hero.subtitle')}</p>

        <ul className="mt-8 flex flex-col gap-3">
          {highlights.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-white">
              <span className="grid size-8 place-items-center rounded-full bg-white/15">
                <Icon className="size-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-sm text-white/70">bingoo.ai</p>
    </aside>
  );
}

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
    <div className="grid min-h-dvh lg:grid-cols-2">
      <BrandPanel />

      <div className="flex flex-col">
        <TopBar />
        <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}

function TopBar() {
  const t = useTranslations('auth.shared');
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="lg:hidden">
          <Logo height={26} />
        </span>
        <span className="hidden items-center gap-1.5 lg:inline-flex">
          <ArrowLeft className="size-4" />
          {t('backToHome')}
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </div>
  );
}

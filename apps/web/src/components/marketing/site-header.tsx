'use client';

import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { LocaleSwitcher } from '@/components/brand/locale-switcher';
import { ThemeToggle } from '@/components/brand/theme-toggle';
import { buttonVariants, Container } from '@bingoo/ui-web';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const NAV: { key: string; href: string; route?: boolean }[] = [
  { key: 'features', href: '#features' },
  { key: 'subjects', href: '#subjects' },
  { key: 'howItWorks', href: '#how' },
  { key: 'forParents', href: '#parents' },
  { key: 'pricing', href: '/pricing', route: true },
  { key: 'help', href: '/faq', route: true },
];

export function SiteHeader() {
  const t = useTranslations();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-colors',
        scrolled
          ? 'border-b border-border bg-background/80 backdrop-blur-lg'
          : 'border-b border-transparent',
      )}
    >
      <Container size="xl">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            aria-label="Bingoo"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo height={44} />
          </Link>

          <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Primary">
            {NAV.map((item) => {
              const cls =
                'whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground';
              return item.route ? (
                <Link key={item.key} href={item.href} className={cls}>
                  {t(`nav.${item.key}`)}
                </Link>
              ) : (
                <a key={item.key} href={item.href} className={cls}>
                  {t(`nav.${item.key}`)}
                </a>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 xl:flex">
            <LocaleSwitcher />
            <ThemeToggle />
            <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              {t('common.actions.signIn')}
            </Link>
            <Link href="/register" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
              {t('common.actions.getStarted')}
            </Link>
          </div>

          <button
            type="button"
            className="grid size-10 place-items-center rounded-full text-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
            aria-label={open ? t('common.actions.close') : 'Menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </Container>

      {open && (
        <div className="border-t border-border bg-background xl:hidden">
          <Container size="xl" className="flex flex-col gap-1 py-4">
            {NAV.map((item) => {
              const cls =
                'rounded-xl px-4 py-3 text-sm font-semibold text-foreground hover:bg-surface-muted';
              return item.route ? (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cls}
                >
                  {t(`nav.${item.key}`)}
                </Link>
              ) : (
                <a key={item.key} href={item.href} onClick={() => setOpen(false)} className={cls}>
                  {t(`nav.${item.key}`)}
                </a>
              );
            })}
            <div className="mt-2 flex items-center justify-between">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className={buttonVariants({ variant: 'secondary' })}
              >
                {t('common.actions.signIn')}
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className={buttonVariants({ variant: 'primary' })}
              >
                {t('common.actions.getStarted')}
              </Link>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}

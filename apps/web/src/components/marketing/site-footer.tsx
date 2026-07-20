import { Heart } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Logo } from '@/components/brand/logo'
import { Container } from '@bingoo.ai/ui-web'
import { Link } from '@/i18n/navigation'

const GROUPS = {
  product: ['features', 'subjects', 'pricing', 'forParents'],
  company: ['about', 'careers', 'contact', 'blog'],
  resources: ['help', 'community', 'blog'],
  legal: ['privacy', 'terms', 'cookies'],
} as const

export function SiteFooter() {
  const t = useTranslations('landing.footer')
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-surface-muted/40">
      <Container size="xl" className="py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <Logo height={36} />
            <p className="mt-4 text-sm text-foreground-muted">{t('tagline')}</p>
          </div>

          {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((group) => (
            <div key={group}>
              <h4 className="font-display text-sm font-semibold text-foreground">{t(`groups.${group}`)}</h4>
              <ul className="mt-4 flex flex-col gap-3">
                {GROUPS[group].map((link) => (
                  <li key={link}>
                    <Link
                      href="/"
                      className="text-sm text-foreground-muted transition-colors hover:text-foreground"
                    >
                      {t(`links.${link}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-sm text-foreground-muted sm:flex-row">
          <p>{t('copyright', { year })}</p>
          <p className="inline-flex items-center gap-1.5">
            {t('madeWith')}
            <Heart className="size-4 fill-accent-coral text-accent-coral" />
          </p>
        </div>
      </Container>
    </footer>
  )
}

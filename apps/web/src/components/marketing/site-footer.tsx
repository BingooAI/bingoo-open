// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { useTranslations } from 'next-intl'
import { Logo } from '@/components/brand/logo'
import { Container } from '@bingoo.ai/ui-web'

const REPO = 'https://github.com/BingooAI/bingoo-open'

/**
 * Every link goes somewhere real.
 *
 * The previous footer listed fourteen — careers, blog, pricing, cookie policy — and all of them
 * pointed at `/`. A dead link is worse than a missing one: it costs the reader a click to learn
 * that a section they were promised does not exist.
 */
const GROUPS: Record<string, { key: string; href: string }[]> = {
  product: [
    { key: 'docs', href: `${REPO}#whats-inside` },
    { key: 'cloud', href: 'https://bingoo.ai/cloud' },
    { key: 'network', href: 'https://bingoo.ai/network' },
  ],
  resources: [
    { key: 'github', href: REPO },
    { key: 'issues', href: `${REPO}/issues` },
    { key: 'security', href: `${REPO}/blob/main/SECURITY.md` },
  ],
  community: [
    { key: 'contributing', href: `${REPO}/blob/main/CONTRIBUTING.md` },
    { key: 'licence', href: `${REPO}/blob/main/LICENSE` },
    { key: 'trademark', href: `${REPO}/blob/main/TRADEMARK.md` },
  ],
}

export function SiteFooter() {
  const t = useTranslations('landing.footer')
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-surface-muted/40">
      <Container size="xl" className="py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Logo height={36} />
            <p className="mt-4 text-sm text-foreground-muted">{t('tagline')}</p>
          </div>

          {Object.entries(GROUPS).map(([group, links]) => (
            <div key={group}>
              <h4 className="font-display text-sm font-semibold text-foreground">{t(`sections.${group}`)}</h4>
              <ul className="mt-4 flex flex-col gap-3">
                {links.map(({ key, href }) => (
                  <li key={key}>
                    <a
                      href={href}
                      rel="noreferrer"
                      className="text-sm text-foreground-muted transition-colors hover:text-foreground"
                    >
                      {t(`links.${key}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-sm text-foreground-muted sm:flex-row">
          <p>{t('copyright', { year })}</p>
          <p>{t('madeWith')}</p>
        </div>
      </Container>
    </footer>
  )
}

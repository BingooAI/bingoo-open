import { Ban, Lock, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import type { Metadata } from 'next'
import type { ComponentType } from 'react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Callout, Card, Container, IconChip, type IconChipColor } from '@bingoo/ui-web'
import { SiteFooter } from '@/components/marketing/site-footer'
import { SiteHeader } from '@/components/marketing/site-header'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'safety' })
  return { title: t('metaTitle'), description: t('metaDescription') }
}

const ITEMS: { key: string; Icon: ComponentType<{ className?: string }>; color: IconChipColor }[] = [
  { key: '0', Icon: ShieldCheck, color: 'success' },
  { key: '1', Icon: Ban, color: 'coral' },
  { key: '2', Icon: SlidersHorizontal, color: 'primary' },
  { key: '3', Icon: Lock, color: 'teal' },
]

export default async function SafetyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('safety')

  return (
    <div data-pack="playful" className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <Container size="lg" className="py-16 sm:py-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <IconChip color="success" size="lg" tone="gradient" className="mx-auto mb-5">
              <ShieldCheck />
            </IconChip>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {t('title')}
            </h1>
            <p className="mt-3 text-lg text-foreground-muted">{t('subtitle')}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {ITEMS.map(({ key, Icon, color }) => (
              <Card key={key} className="flex gap-4 p-6">
                <IconChip color={color} size="lg" tone="gradient">
                  <Icon />
                </IconChip>
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">{t(`items.${key}.t`)}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">
                    {t(`items.${key}.d`)}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-2xl">
            <Callout variant="success" title={t('metaTitle')}>
              {t('note')}
            </Callout>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  )
}

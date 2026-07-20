import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Accordion, Container } from '@bingoo/ui-web'
import { SiteFooter } from '@/components/marketing/site-footer'
import { SiteHeader } from '@/components/marketing/site-header'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'faq' })
  return { title: t('metaTitle'), description: t('metaDescription') }
}

export default async function FAQPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('faq')

  const raw = t.raw('items') as Record<string, { q: string; a: string }>
  const items = Object.entries(raw).map(([id, v]) => ({ id, title: v.q, content: v.a }))

  return (
    <div data-pack="playful" className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <Container size="lg" className="py-16 sm:py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {t('title')}
            </h1>
            <p className="mt-3 text-lg text-foreground-muted">{t('subtitle')}</p>
          </div>
          <div className="mx-auto max-w-2xl">
            <Accordion items={items} defaultOpen={['0']} />
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  )
}

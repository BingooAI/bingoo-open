import { setRequestLocale } from 'next-intl/server'
import { Hero } from '@/components/marketing/hero'
import {
  CtaBand,
  Features,
  HowItWorks,
  Parents,
  Stats,
  Subjects,
  Testimonials,
} from '@/components/marketing/sections'
import { SiteFooter } from '@/components/marketing/site-footer'
import { SiteHeader } from '@/components/marketing/site-header'

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    // Marketing runs in the Playful pack → filled buttons get the chunky 3D depth.
    <div data-pack="playful" className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Stats />
        <Features />
        <Subjects />
        <HowItWorks />
        <Parents />
        <Testimonials />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  )
}

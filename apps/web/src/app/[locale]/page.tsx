// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { setRequestLocale } from 'next-intl/server'
import { Hero } from '@/components/marketing/hero'
import {
  CtaBand,
  Editions,
  Frameworks,
  Measure,
  Openness,
  Stats,
  Transfer,
} from '@/components/marketing/sections'
import { SiteFooter } from '@/components/marketing/site-footer'
import { SiteHeader } from '@/components/marketing/site-header'

/**
 * The landing page.
 *
 * Ordered as a reader's questions arrive: what is it, what is in it, how does it measure, how do
 * I run it, what happens when a learner moves, why is it open, how do I start. The open edition
 * carries the page; Cloud and Network appear once, described rather than sold.
 */
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div data-pack="playful" className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Stats />
        <Frameworks />
        <Measure />
        <Editions />
        <Transfer />
        <Openness />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  )
}

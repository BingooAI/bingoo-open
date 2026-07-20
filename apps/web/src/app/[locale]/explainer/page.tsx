// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { setRequestLocale } from 'next-intl/server'
import { ExplainerView } from '@/components/explainer/ExplainerView'

/** Acceptance route: plays the migrated engine's authored lesson end-to-end. */
export default async function ExplainerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <ExplainerView />
}

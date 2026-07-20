// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { setRequestLocale } from 'next-intl/server'
import { StudioView } from '@/components/explainer/StudioView'

/** Explainer Studio — the lesson editor. Full-screen: no admin shell. */
export default async function StudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <StudioView />
}

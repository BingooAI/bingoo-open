// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { setRequestLocale } from 'next-intl/server'
import { FrameworkDetail } from '@/components/authoring/framework-detail'

export default async function FrameworkDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  return <FrameworkDetail slug={slug} />
}

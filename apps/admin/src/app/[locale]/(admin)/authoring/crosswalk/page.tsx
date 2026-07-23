// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@bingoo.ai/ui-web'
import { CrosswalkView } from '@/components/authoring/crosswalk-view'

export default async function CrosswalkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin.authoring')
  return (
    <div className="space-y-6">
      <PageHeader title={t('crosswalkTitle')} description={t('crosswalkPageDesc')} />
      <CrosswalkView />
    </div>
  )
}

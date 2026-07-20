// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@bingoo.ai/ui-web'
import { AuthoringHub } from '@/components/authoring/authoring-hub'

/**
 * Biên soạn — sinh khung năng lực (PDF/prompt) rồi sinh vỏ khoá bám khung.
 * Layout (admin) đã chặn non-staff; API chặn lại theo vai (CONTENT_EDITOR|ADMIN).
 */
export default async function AuthoringPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'admin.authoring' })

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />
      <AuthoringHub />
    </div>
  )
}

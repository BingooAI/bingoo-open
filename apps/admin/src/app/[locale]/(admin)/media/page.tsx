// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@bingoo.ai/ui-web'
import { MediaBrowser } from '@/components/media/media-browser'
import { resolveCapabilities } from '@/lib/roles'
import { getServerSession } from '@/lib/session'

/**
 * Media library — the browser (folder tree, faceted search, asset grid, detail
 * panel, upload). The admin layout already gated this to staff; we resolve
 * capabilities here to hand the client-side browser its allowed actions (the API
 * re-enforces every one).
 */
export default async function MediaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'admin' })
  const session = await getServerSession()
  const caps = resolveCapabilities(session?.user.role)

  return (
    <div className="space-y-6">
      <PageHeader title={t('library.title')} description={t('library.description')} />
      <MediaBrowser caps={caps} />
    </div>
  )
}

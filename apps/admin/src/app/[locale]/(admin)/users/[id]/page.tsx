// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@bingoo.ai/ui-web'
import { Link } from '@/i18n/navigation'
import { UserDetail } from '@/components/users/user-detail'

/** Chi tiết một người dùng. Dữ liệu học tập của trẻ — mọi lượt đọc đều được ghi audit ở API. */
export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'admin.users' })

  return (
    <div className="space-y-6">
      <Link href="/users" className="text-sm font-semibold text-primary hover:underline">
        {t('backToList')}
      </Link>
      <PageHeader title={t('detailTitle')} description={t('detailDescription')} />
      <UserDetail userId={id} />
    </div>
  )
}

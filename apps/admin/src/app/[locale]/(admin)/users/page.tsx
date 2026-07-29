// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@bingoo.ai/ui-web'
import { UsersList } from '@/components/users/users-list'

/** Quản lý người dùng — vào chi tiết để đọc hồ sơ học tập theo khung chương trình. */
export default async function UsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'admin.users' })

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />
      <UsersList />
    </div>
  )
}
